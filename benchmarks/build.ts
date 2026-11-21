import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import react from '@vitejs/plugin-react';
import vue from '@vitejs/plugin-vue';
import { build, type InlineConfig, type Plugin } from 'vite';
import { LIBRARIES, SCENARIOS, SETUPS, type Library, type Setup } from './scenarios.ts';

const require = createRequire(import.meta.url);
const HARNESS = join(import.meta.dirname, 'harness');
const LIBRARIES_FOLDER = join(import.meta.dirname, 'libraries');

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
    outDir: join(import.meta.dirname, 'dist', setup.id, 'EmptyApp'),
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
    outDir: join(import.meta.dirname, 'dist', setup.id, library.id, scenario),
  };
}

/** Each library of the framework of `setup`. */
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
export function appConfig(app: App): InlineConfig {
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
    plugins: [...frameworkPlugins(setup), entryScript(app.entry)],
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

/** Each app: the empty app of each setup, then each scenario of each library in each setup. */
export function allApps(): App[] {
  return SETUPS.flatMap((setup) => [
    emptyApp(setup),
    ...SCENARIOS.flatMap((scenario) =>
      librariesOf(setup).flatMap((library) => libraryApp(setup, library, scenario) ?? []),
    ),
  ]);
}

export async function buildApp(app: App): Promise<void> {
  await build(appConfig(app));
}

if (import.meta.main) {
  for (const app of allApps()) {
    await buildApp(app);
  }
}
