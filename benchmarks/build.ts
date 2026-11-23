import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import react from '@vitejs/plugin-react';
import { build, type InlineConfig, type Plugin } from 'vite';
import { BEHAVIOR_SCENARIOS } from './behavior/groups.ts';
import type { ServerRender } from './harness/serverRender.ts';
import { LIBRARIES, SCENARIOS, SETUPS, type Library, type Setup } from './scenarios.ts';

// The compiler of Vue loads its production build only when `NODE_ENV` is `production` at its first
// `require`, and `@vitejs/plugin-vue` loads Vue when it loads. Vite sets `NODE_ENV` only inside
// `build()`, and the development compiler keeps template comments.
process.env.NODE_ENV = 'production';
const { default: vue } = await import('@vitejs/plugin-vue');

const require = createRequire(import.meta.url);
const HARNESS = join(import.meta.dirname, 'harness');
const LIBRARIES_FOLDER = join(import.meta.dirname, 'libraries');
const DIST = join(import.meta.dirname, 'dist');

/** The file in which the build of a hydration page records why its server render failed. */
export const SERVER_RENDER_ERROR_FILE = 'server-render-error.txt';

/** One app: the empty app of a setup, or a scenario of a library. */
export interface App {
  setup: Setup;
  /** The entry module, from `harness`. */
  entry: string;
  /** The component that the harness renders. */
  scenarioFile: string;
  outDir: string;
}

function fixtureFile(library: Library, scenario: string): string {
  const extension = library.framework === 'vue' ? 'vue' : 'tsx';
  return join(LIBRARIES_FOLDER, library.id, `${scenario}.${extension}`);
}

export function emptyApp(setup: Setup): App {
  const extension = setup.framework === 'vue' ? 'vue' : 'tsx';
  return {
    setup,
    entry: setup.emptyAppEntry,
    scenarioFile: join(HARNESS, setup.framework, `EmptyApp.${extension}`),
    outDir: join(DIST, setup.id, 'EmptyApp'),
  };
}

/** The app of a scenario of a library, or `undefined` when the library has no fixture for it. */
export function libraryApp(setup: Setup, library: Library, scenario: string): App | undefined {
  const scenarioFile = fixtureFile(library, scenario);
  if (!existsSync(scenarioFile)) {
    return undefined;
  }
  return {
    setup,
    entry: setup.entry,
    scenarioFile,
    outDir: join(DIST, setup.id, library.id, scenario),
  };
}

/**
 * The app of a behavior fixture, or `undefined` when the library has no such fixture. A Vue library
 * runs in the setup `vdom`, and Base UI in `react`.
 */
export function behaviorApp(library: Library, scenario: string): App | undefined {
  const setup = SETUPS.find((item) => item.id === (library.framework === 'vue' ? 'vdom' : 'react'));
  return setup && libraryApp(setup, library, `behavior/${scenario}`);
}

/**
 * The page that hydrates the server HTML of `AllComponents` of a library, or `undefined` when the
 * library has no such fixture.
 */
export function hydrationApp(setup: Setup, library: Library): App | undefined {
  const app = libraryApp(setup, library, 'AllComponents');
  return (
    app && {
      ...app,
      entry: setup.hydrateEntry,
      outDir: join(DIST, 'hydration', setup.id, library.id),
    }
  );
}

export function librariesOf(setup: Setup): Library[] {
  return LIBRARIES.filter((library) => library.framework === setup.framework);
}

/**
 * Adds `vapor` to the root `<template>` of each SFC of the harness and of the fixtures, so that
 * these SFCs and no SFC of a library compile in Vapor mode. A template-only SFC has no
 * `<script setup>` to mark.
 */
const vaporMode: Plugin = {
  name: 'vapor-mode',
  enforce: 'pre',
  transform(code, id) {
    const isOwnSfc =
      id.endsWith('.vue') &&
      [HARNESS, LIBRARIES_FOLDER].some((folder) => id.startsWith(`${folder}/`));
    return isOwnSfc ? code.replace(/^<template\b/m, '<template vapor') : undefined;
  },
};

/** Adds the entry of the app to `harness/index.html`. */
function entryScript(entry: string): Plugin {
  return {
    name: 'benchmark-entry',
    transformIndexHtml: {
      order: 'pre',
      handler: () => [
        { tag: 'script', attrs: { type: 'module', src: `/${entry}` }, injectTo: 'body' },
      ],
    },
  };
}

function frameworkPlugins(setup: Setup): Plugin[] {
  if (setup.framework === 'react') {
    return react();
  }
  const compiler: typeof import('vue/compiler-sfc') = require(
    `${setup.frameworkPackage}/compiler-sfc`,
  );
  return [...(setup.vapor ? [vaporMode] : []), vue({ compiler })];
}

/**
 * The one Vite config of each app: the defaults of Vite for a production build, with one
 * JavaScript chunk.
 */
function appConfig(app: App, plugins: Plugin[] = []): InlineConfig {
  const { setup } = app;
  // The alias gives the app one copy of Vue, the one of the setup, also when a library or the
  // workspace package resolves another version of `vue`.
  const frameworkAlias =
    setup.framework === 'vue'
      ? [
          {
            find: /^vue(?=$|\/)/,
            replacement: dirname(require.resolve(`${setup.frameworkPackage}/package.json`)),
          },
        ]
      : [];
  return {
    configFile: false,
    root: HARNESS,
    logLevel: 'warn',
    // A relative base lets `time.ts` open each app in a folder of `dist`.
    base: './',
    plugins: [...frameworkPlugins(setup), entryScript(app.entry), ...plugins],
    resolve: {
      alias: [{ find: '#scenario', replacement: app.scenarioFile }, ...frameworkAlias],
    },
    build: {
      outDir: app.outDir,
      // The size counts each file of the folder, so a file of an earlier build must go.
      emptyOutDir: true,
      modulePreload: { polyfill: false },
      rolldownOptions: { output: { codeSplitting: false } },
    },
  };
}

function allApps(): App[] {
  return [
    ...SETUPS.flatMap((setup) => [
      emptyApp(setup),
      ...SCENARIOS.flatMap((scenario) =>
        librariesOf(setup).flatMap((library) => libraryApp(setup, library, scenario) ?? []),
      ),
    ]),
    ...BEHAVIOR_SCENARIOS.flatMap((scenario) =>
      LIBRARIES.flatMap((library) => behaviorApp(library, scenario) ?? []),
    ),
  ];
}

export async function buildApp(app: App): Promise<void> {
  await build(appConfig(app));
}

/** Builds the server entry of the setup for the app, and renders the app in this process. */
async function renderOnServer(app: App, outDir: string): Promise<ServerRender> {
  await build({
    ...appConfig(app),
    ssr: { noExternal: true },
    build: {
      ssr: app.setup.serverEntry,
      outDir,
      emptyOutDir: true,
      rolldownOptions: { output: { codeSplitting: false, entryFileNames: 'server.js' } },
    },
  });
  const server = (await import(pathToFileURL(join(outDir, 'server.js')).href)) as {
    render: () => ServerRender | Promise<ServerRender>;
  };
  const rendered = await server.render();
  const [error] = rendered.errors;
  if (error !== undefined) {
    throw new Error(error);
  }
  return rendered;
}

/** Puts the server HTML in the page of the hydration build. */
function serverHtml({ html, teleports }: ServerRender): Plugin {
  return {
    name: 'server-html',
    transformIndexHtml: {
      order: 'pre',
      // Vue hydrates a teleport to `body` from the first child of `body`.
      handler: (page) =>
        page
          .replace('<body>', `<body>${teleports.body ?? ''}`)
          .replace('<div id="app"></div>', `<div id="app">${html}</div>`),
    },
  };
}

/**
 * Renders the app on the server, and builds the page that hydrates that HTML. When the server
 * render fails, the folder of the page holds only the reason, and the build goes on.
 */
export async function buildHydrationApp(app: App): Promise<void> {
  rmSync(app.outDir, { recursive: true, force: true });
  let rendered: ServerRender;
  try {
    // The build of the page empties the folder, so the server build goes there first.
    rendered = await renderOnServer(app, join(app.outDir, 'server'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const reason = `The server render failed: ${message.split('\n')[0] ?? ''}`;
    console.warn(`${app.outDir}: ${reason}`);
    mkdirSync(app.outDir, { recursive: true });
    writeFileSync(join(app.outDir, SERVER_RENDER_ERROR_FILE), reason);
    return;
  }
  await build(appConfig(app, [serverHtml(rendered)]));
}

if (import.meta.main) {
  for (const app of allApps()) {
    await buildApp(app);
  }
  for (const setup of SETUPS) {
    for (const library of librariesOf(setup)) {
      const app = hydrationApp(setup, library);
      if (app) {
        await buildHydrationApp(app);
      }
    }
  }
}
