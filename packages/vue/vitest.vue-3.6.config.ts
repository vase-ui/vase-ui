// Runs the browser tests of the `.test.ts` files of `src` and `test/measurements`, and of
// `test/as.test.ts`, with Vue 3.6, in the setups of virtual DOM and Vapor. Run
// `pnpm install:vue-3.6` at the root of the repository first. Then run:
//   pnpm exec vitest run --config vitest.vue-3.6.config.ts
import vue from '@vitejs/plugin-vue';
import { playwright } from '@vitest/browser-playwright';
import type { Plugin } from 'vite';
import { configDefaults, defineConfig, type TestProjectInlineConfiguration } from 'vitest/config';
import { BaseSequencer, type TestSpecification } from 'vitest/node';
import { lockClipboard, unlockClipboard } from './test/server/clipboard.ts';
import { collectGarbage } from './test/server/collectGarbage.ts';
import { contextOptions, engineInstances } from './test/server/engineInstances.ts';
import { renderOnServer } from './test/server/renderOnServer.ts';
import type { AppKind } from './test/render.ts';

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

/**
 * Gives the specs of each browser to the shards in turn, in the order of their files. Vitest puts
 * all projects of a file in one shard by a hash of its path, and a shard of slow files takes two
 * times as long as the mean. Firefox runs one file at a time, so each browser needs an even share.
 */
class RoundRobinSequencer extends BaseSequencer {
  override shard(specs: TestSpecification[]) {
    // Vitest calls `shard` only with the option `shard`.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { index, count } = this.ctx.config.shard!;
    const key = (spec: TestSpecification) =>
      [spec.project.config.browser.name, spec.moduleId, spec.project.name].join('\n');
    const sorted = specs.toSorted((a, b) => (key(a) < key(b) ? -1 : 1));
    return Promise.resolve(sorted.filter((_, position) => position % count === index - 1));
  }
}

function setup(name: string, app: AppKind, vapor?: RegExp): TestProjectInlineConfiguration {
  return {
    plugins: [vaporMode(vapor), vue()],
    define: {
      'process.env.NODE_ENV': JSON.stringify('test'),
    },
    resolve: { tsconfigPaths: true },
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
        commands: { collectGarbage, lockClipboard, renderOnServer, unlockClipboard },
        instances: engineInstances(name),
      },
    },
  };
}

export default defineConfig({
  test: {
    // The file cache of Vitest identifies a transformed module by the names of the plugins and not
    // by their options. With the cache, the server render of one project can get a fixture that
    // another project compiled in the other mode, and the hydration cases fail.
    fsModuleCache: false,
    sequence: { sequencer: RoundRobinSequencer },
    projects: [
      setup('vdom app, vdom parts', 'vdom'),
      setup('vapor app, vdom parts', 'vapor-interop', /\/test\/fixtures\/\w+\.vue$/),
      setup('vapor app, vapor parts', 'vapor', /\.vue$/),
      setup('vdom app, vapor parts', 'vdom-interop', /\/src\/[\w-]+\/\w+\.vue$/),
    ],
  },
});
