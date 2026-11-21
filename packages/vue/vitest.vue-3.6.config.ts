// Runs the browser tests of `src` and of `test/measurements` with Vue 3.6, in the setups of virtual
// DOM and Vapor:
//   pnpm exec vitest run --config vitest.vue-3.6.config.ts
import { createRequire } from 'node:module';
import vue from '@vitejs/plugin-vue';
import { playwright } from '@vitest/browser-playwright';
import { resolve } from 'node:path';
import { createServer, type InlineConfig, type Plugin, type ViteDevServer } from 'vite';
import { configDefaults, defineConfig, type TestProjectInlineConfiguration } from 'vitest/config';
import type { BrowserCommand } from 'vitest/node';
import { collectGarbage } from './test/server/collectGarbage.ts';
import { contextOptions, engineInstances } from './test/server/engineInstances.ts';
import type * as RenderToHtml from './test/server/renderToHtml.ts';
import type { AppKind } from './test/render.ts';

const compiler = createRequire(import.meta.url)('vue-3.6/compiler-sfc');

/**
 * Compiles the SFCs that `vapor` matches in Vapor mode. The option `features.vapor` of plugin-vue
 * does not fit: plugin-vue keeps each compiled script for a parsed source, so a project would get
 * the script that another project compiled from the same source.
 */
function vaporMode(vapor: RegExp | undefined): Plugin {
  return {
    name: 'vapor-mode',
    enforce: 'pre',
    transform(code, id) {
      return vapor?.test(id)
        ? code.replace(/<script\b[^>]*\bsetup\b(?! vapor)/, (tag) => `${tag} vapor`)
        : undefined;
    },
  };
}

const resolveOptions = {
  alias: [{ find: /^vue(?=$|\/)/, replacement: 'vue-3.6' }],
  tsconfigPaths: true,
};

/**
 * The command `renderOnServer` of `vitest.config.ts`, with Vue 3.6. The module runner of a test
 * project loads Vue as an external module, and Node then ignores the alias. This Vite server
 * transforms each module, so the server render takes Vue 3.6 and compiles the fixtures in the mode
 * of the project.
 */
function renderOnServerWith(config: InlineConfig) {
  let server: Promise<ViteDevServer> | undefined;
  const renderOnServer: BrowserCommand<[file: string, props?: Record<string, unknown>]> = async (
    { project },
    file,
    props,
  ) => {
    server ??= createServer({
      ...config,
      configFile: false,
      root: project.config.root,
      appType: 'custom',
      logLevel: 'warn',
      server: { middlewareMode: true, ws: false, watch: null },
      ssr: { noExternal: true, resolve: { conditions: ['module', 'development|production'] } },
    });
    const vite = await server;
    const { renderToHtml } = (await vite.ssrLoadModule(
      '/test/server/renderToHtml.ts',
    )) as typeof RenderToHtml;
    return renderToHtml(resolve(project.config.root, file), props);
  };
  return renderOnServer;
}

function setup(name: string, app: AppKind, vapor?: RegExp): TestProjectInlineConfiguration {
  const plugins = () => [vaporMode(vapor), vue({ compiler })];
  return {
    plugins: plugins(),
    define: {
      'process.env.NODE_ENV': JSON.stringify('test'),
    },
    resolve: resolveOptions,
    // Vite finds `axe-core` during a run, and its reload stops the tests in that browser.
    optimizeDeps: { include: ['axe-core'] },
    test: {
      name,
      include: ['src/**/*.test.ts', 'test/measurements/*.test.ts', 'test/as.test.ts'],
      exclude: [...configDefaults.exclude, '**/*.node.test.{ts,tsx}'],
      retry: 0,
      setupFiles: ['./test/setup.ts'],
      provide: { app, testApp: 'vdom', testParts: 'vdom' },
      browser: {
        enabled: true,
        provider: playwright({ contextOptions }),
        headless: true,
        screenshotFailures: false,
        commands: {
          collectGarbage,
          renderOnServer: renderOnServerWith({ plugins: plugins(), resolve: resolveOptions }),
        },
        instances: engineInstances(name),
      },
    },
  };
}

export default defineConfig({
  test: {
    projects: [
      setup('vdom app, vdom parts', 'vdom'),
      setup('vapor app, vdom parts', 'vapor-interop', /\/test\/fixtures\/\w+\.vue$/),
      setup('vapor app, vapor parts', 'vapor', /\.vue$/),
      setup('vdom app, vapor parts', 'vdom-interop', /\/src\/[\w-]+\/\w+\.vue$/),
    ],
  },
});
