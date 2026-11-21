import { fileURLToPath } from 'node:url';
import type { ModuleOptions } from '@vase-ui/vue/nuxt';
import { loadNuxt } from 'nuxt/kit';
import type { Component, Import } from 'nuxt/schema';
import { describe, expect, it } from 'vitest';

const rootDir = fileURLToPath(new URL('..', import.meta.url));

// What the module adds to a Nuxt app with the options `vaseUi`.
async function loadModule(vaseUi: ModuleOptions) {
  const nuxt = await loadNuxt({ cwd: rootDir, overrides: { vaseUi } });
  try {
    const components: Component[] = [];
    await nuxt.callHook('components:extend', components);
    const imports: Import[] = [];
    await nuxt.callHook('imports:extend', imports);
    return {
      components: components.map((component) => component.pascalName),
      imports: imports.map((entry) => entry.as ?? entry.name),
      plugins: nuxt.options.plugins.map((plugin) =>
        typeof plugin === 'string' ? plugin : plugin.src,
      ),
      optimizedDependencies: nuxt.options.vite.optimizeDeps?.include ?? [],
    };
  } finally {
    await nuxt.close();
  }
}

const DIALOG_PARTS = [
  'Backdrop',
  'Close',
  'Description',
  'Popup',
  'Portal',
  'Root',
  'Title',
  'Trigger',
  'Viewport',
];

describe('the Nuxt module', () => {
  it('adds each part as a component, and each namespace and composable as an import', async () => {
    const { components, imports } = await loadModule({});

    expect(components.filter((name) => name.startsWith('Dialog')).sort()).toEqual(
      DIALOG_PARTS.map((part) => `Dialog${part}`),
    );
    expect(components).toContain('Button');
    expect(imports).toEqual(expect.arrayContaining(['Dialog', 'useElement']));
    expect(imports).not.toContain('Button');
  });

  it('puts the prefix before each name', async () => {
    const { components, imports } = await loadModule({ prefix: 'Vase' });

    expect(components).toEqual(expect.arrayContaining(['VaseDialogRoot', 'VaseButton']));
    expect(components).not.toContain('DialogRoot');
    expect(imports).toEqual(expect.arrayContaining(['VaseDialog', 'useVaseElement']));
    expect(imports).not.toContain('Dialog');
  });

  it('loads the Temporal module that the app resolves, and pre-bundles it', async () => {
    const { plugins, optimizedDependencies } = await loadModule({
      temporal: 'temporal-polyfill/full/global',
    });

    expect(plugins.filter((plugin) => plugin.endsWith('vase-ui/temporal.mjs'))).toHaveLength(1);
    expect(optimizedDependencies).toContain('temporal-polyfill/full/global');
  });

  it.each([
    { temporal: false as const, title: 'false' },
    { temporal: 'a-module-that-is-not-installed', title: 'a module that the app cannot resolve' },
  ])('loads no Temporal module with $title', async ({ temporal }) => {
    const { plugins, optimizedDependencies } = await loadModule({ temporal });

    expect(plugins.filter((plugin) => plugin.endsWith('vase-ui/temporal.mjs'))).toEqual([]);
    expect(optimizedDependencies).not.toContain(temporal);
  });
});
