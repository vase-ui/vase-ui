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
  'utils/use-element.md',
  'quick-start.md',
  'handbook/styling.md',
];

function server({ pages = LOADED_PAGES, plugin = viteFollowSource(SOURCE_ROOT) } = {}) {
  const { configureServer, hotUpdate } = plugin;
  assert.ok(typeof configureServer === 'function' && typeof hotUpdate === 'function');
  const byId = new Map(pages.map((path) => [posix.join(DOCS_ROOT, path), { id: path }]));
  const watched: string[] = [];
  const invalidated: unknown[][] = [];
  const fixture: unknown = {
    server: { watcher: { add: (folder: string) => watched.push(folder) } },
    context: {
      environment: {
        config: { root: DOCS_ROOT },
        moduleGraph: {
          getModuleById: (id: string) => byId.get(id),
          invalidateModule: (...call: unknown[]) => invalidated.push(call),
        },
      },
    },
    event: { modules: [SOURCE_MODULE] },
  };
  // The two hooks read only these fields of the Vite server, context and event.
  const {
    server: devServer,
    context,
    event,
  } = fixture as {
    server: Parameters<typeof configureServer>[0];
    context: ThisParameterType<typeof hotUpdate>;
    event: Parameters<typeof hotUpdate>[0];
  };
  return {
    invalidated,
    async watch() {
      await configureServer.call(context, devServer);
      return watched;
    },
    update(file: string, type: typeof event.type = 'update') {
      return hotUpdate.call(context, { ...event, file: file.replaceAll(sep, '/'), type });
    },
  };
}

test('a source edit gives the module of each family page that the server has', () => {
  const { update } = server();
  const file = join(SOURCE_ROOT, 'dialog/popup/DialogPopup.vue');
  for (const type of ['create', 'update', 'delete'] as const) {
    assert.deepEqual(update(file, type), [
      SOURCE_MODULE,
      { id: 'components/button.md' },
      { id: 'utils/use-element.md' },
    ]);
  }
});

test('a source edit makes Vite discard the transform in progress of each family page', () => {
  const { invalidated, update } = server();
  void update(join(SOURCE_ROOT, 'dialog/popup/DialogPopup.vue'));
  // Vite discards the transform only for a call with no hot update argument.
  assert.deepEqual(invalidated, [
    [{ id: 'components/button.md' }],
    [{ id: 'utils/use-element.md' }],
  ]);
});

test('a test file gives no page module', () => {
  const { invalidated, update } = server();
  for (const path of ['button/Button.test.tsx', 'button/Button.spec.vue']) {
    assert.equal(update(join(SOURCE_ROOT, path)), undefined, path);
  }
  assert.deepEqual(invalidated, []);
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

test('the plugin of the site configuration watches the source folder of the package', async () => {
  const plugin = config.vite?.plugins?.find(
    (item): item is Plugin =>
      !!item && typeof item === 'object' && 'name' in item && item.name === 'vase-ui:follow-source',
  );
  assert.ok(plugin);
  assert.deepEqual(await server({ plugin }).watch(), [SOURCE_ROOT]);
});
