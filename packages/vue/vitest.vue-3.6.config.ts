// Runs the browser tests with Vue 3.6, in the setups of virtual DOM and Vapor:
//   pnpm exec vitest run --config vitest.vue-3.6.config.ts
import { createRequire } from 'node:module';
import vue from '@vitejs/plugin-vue';
import { playwright } from '@vitest/browser-playwright';
import type { Plugin } from 'vite';
import { configDefaults, defineConfig, type TestProjectInlineConfiguration } from 'vitest/config';
import { browserInstances, serverRenderCommands } from './test/browserConfig.ts';
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
      return vapor?.test(id) ? code.replace('<script setup', '<script setup vapor') : undefined;
    },
  };
}

const resolve = {
  alias: [{ find: /^vue(?=$|\/)/, replacement: 'vue-3.6' }],
  tsconfigPaths: true,
};

function setup(name: string, app: AppKind, vapor?: RegExp): TestProjectInlineConfiguration {
  return {
    plugins: [vaporMode(vapor), vue({ compiler })],
    define: {
      'process.env.NODE_ENV': JSON.stringify('test'),
    },
    resolve,
    test: {
      name,
      include: ['src/**/*.test.{ts,tsx}'],
      exclude: [...configDefaults.exclude, '**/*.node.test.{ts,tsx}'],
      retry: 0,
      provide: { app },
      browser: {
        enabled: true,
        provider: playwright(),
        headless: true,
        screenshotFailures: false,
        commands: serverRenderCommands({ plugins: [vaporMode(vapor), vue({ compiler })], resolve }),
        instances: browserInstances(name),
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
      setup('vdom app, vapor parts', 'vdom-interop', /\/src\/\w+\/\w+\.vue$/),
    ],
  },
});
