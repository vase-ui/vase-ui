import assert from 'node:assert/strict';
import { join, posix, sep } from 'node:path';
import { test } from 'node:test';
import type { Plugin } from 'vitepress';
import { REPOSITORY_ROOT } from '../../scripts/parity/repository.ts';
import config from './config.ts';
import { viteFollowSource } from './viteFollowSource.ts';

const DOCS_ROOT = join(REPOSITORY_ROOT, 'docs').replaceAll(sep, '/');
const SOURCE_ROOT = join(REPOSITORY_ROOT, 'packages/vue/src');
const SOURCE_MODULE = { id: 'source' };
const LOADED_PAGES = [
  'components/button.md',
  'utils/use-render.md',
  'quick-start.md',
  'handbook/styling.md',
];

function server({ pages = LOADED_PAGES, plugin = viteFollowSource(SOURCE_ROOT) } = {}) {
  const byId = new Map(pages.map((path) => [posix.join(DOCS_ROOT, path), { id: path }]));
  const environment = {
    config: { root: DOCS_ROOT },
    moduleGraph: { getModuleById: (id: string) => byId.get(id) },
  };
  const watched: string[] = [];
  const watcher = { add: (folder: string) => watched.push(folder) };
  // The hooks use only these fields of the Vite server, its context and its modules.
  const hooks = plugin as {
    configureServer(options: { watcher: typeof watcher }): void;
    hotUpdate(
      this: { environment: typeof environment },
      options: { file: string; type: string; modules: (typeof SOURCE_MODULE)[] },
    ): unknown;
  };
  return {
    watch() {
      hooks.configureServer({ watcher });
      return watched;
    },
    update(file: string, type = 'update') {
      return hooks.hotUpdate.call(
        { environment },
        {
          file: file.replaceAll(sep, '/'),
          type,
          modules: [SOURCE_MODULE],
        },
      );
    },
  };
}

test('a source edit gives the module of each family page that the server has', () => {
  const { update } = server();
  const file = join(SOURCE_ROOT, 'dialog/popup/DialogPopup.vue');
  for (const type of ['create', 'update', 'delete']) {
    assert.deepEqual(update(file, type), [
      SOURCE_MODULE,
      { id: 'components/button.md' },
      { id: 'utils/use-render.md' },
    ]);
  }
});

test('a test file gives no page module', () => {
  const { update } = server();
  for (const path of ['button/Button.test.tsx', 'button/Button.spec.vue']) {
    assert.equal(update(join(SOURCE_ROOT, path)), undefined, path);
  }
});

test('a file outside the source folder gives no page module', () => {
  const { update } = server();
  for (const file of [
    join(REPOSITORY_ROOT, 'packages/vue/test/setup.ts'),
    `${SOURCE_ROOT}-old/x.ts`,
  ]) {
    assert.equal(update(file), undefined, file);
  }
});

test('a source edit gives nothing while the server has no family page module', () => {
  const { update } = server({ pages: ['quick-start.md'] });
  assert.equal(update(join(SOURCE_ROOT, 'button/Button.vue')), undefined);
});

test('the plugin of the site configuration watches the source folder of the package', () => {
  const plugin = config.vite?.plugins?.find(
    (item): item is Plugin =>
      !!item && typeof item === 'object' && 'name' in item && item.name === 'vase-ui:follow-source',
  );
  assert.ok(plugin);
  assert.deepEqual(server({ plugin }).watch(), [SOURCE_ROOT]);
});
