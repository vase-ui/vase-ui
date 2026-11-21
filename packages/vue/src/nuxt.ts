import { existsSync, readdirSync } from 'node:fs';
import {
  addComponent,
  addImports,
  addPluginTemplate,
  addTemplate,
  defineNuxtModule,
  directoryToURL,
  tryResolveModule,
} from 'nuxt/kit';
import type { Nuxt, NuxtModule } from 'nuxt/schema';

export interface ModuleOptions {
  /**
   * A text that the module puts before each name that it adds. With `'Vase'`, a template uses
   * `<VaseDialog.Root>` and `<VaseButton>`, and a script uses `VaseDialog.createHandle()` and
   * `useVaseElement()`.
   * @default ''
   */
  prefix?: string;
  /**
   * The module that sets the global `Temporal`. The app runs it before it renders, on the server
   * and in the browser, only where the engine has no `Temporal`. When the app cannot resolve the
   * module, or with `false`, the app runs no module.
   * @default 'temporal-polyfill/global'
   */
  temporal?: string | false;
}

const PACKAGE_NAME = '@vase-ui/vue';

function isComponent(value: object): boolean {
  return 'setup' in value;
}

// Each folder of `dist` with an `index.js` is an entry point of the package.
function entryNames(): string[] {
  const dist = new URL('./', import.meta.url);
  return readdirSync(dist, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(new URL(`${entry.name}/index.js`, dist)))
    .map((entry) => entry.name);
}

// Vue compiles `<Dialog.Root>` with no import into `resolveComponent('Dialog.Root')`, and Nuxt
// resolves that name as the component `DialogRoot`. Nuxt imports a component by its export name, so
// a template exports each part of the namespace by its own name.
function addParts(
  entry: string,
  namespace: string,
  parts: Record<string, object>,
  prefix: string,
): void {
  const names = Object.entries(parts)
    .filter(([, part]) => isComponent(part))
    .map(([name]) => name);
  const { dst } = addTemplate({
    filename: `vase-ui/${entry}.ts`,
    // The types of a part in a template, such as `<DialogRoot>`, import this file from the disk.
    write: true,
    getContents: () =>
      [
        `import { ${namespace} } from '${PACKAGE_NAME}/${entry}';`,
        ...names.map((name) => `export const ${name} = ${namespace}.${name};`),
      ].join('\n'),
  });
  for (const name of names) {
    addComponent({ name: `${prefix}${namespace}${name}`, export: name, filePath: dst });
  }
}

function addTemporalPlugin(temporal: string, nuxt: Nuxt): void {
  addPluginTemplate({
    filename: 'vase-ui/temporal.mjs',
    getContents: () =>
      [
        "import { defineNuxtPlugin } from '#imports';",
        '',
        'export default defineNuxtPlugin(async () => {',
        "  if (!('Temporal' in globalThis)) {",
        `    await import(${JSON.stringify(temporal)});`,
        '  }',
        '});',
      ].join('\n'),
  });
  // In development, Vite finds the import only when it serves the plugin. It then optimizes the
  // module and reloads the page.
  nuxt.options.vite.optimizeDeps ??= {};
  nuxt.options.vite.optimizeDeps.include ??= [];
  nuxt.options.vite.optimizeDeps.include.push(temporal);
}

/**
 * Adds the components and the composables of Vase UI to a Nuxt app with no import, and loads the
 * `Temporal` polyfill where the engine has no `Temporal`.
 */
const nuxtModule: NuxtModule<
  ModuleOptions,
  Required<ModuleOptions>,
  true
> = defineNuxtModule<ModuleOptions>().with({
  meta: {
    name: PACKAGE_NAME,
    configKey: 'vaseUi',
    compatibility: { nuxt: '>=4.0.0' },
    docs: 'https://vase-ui.com/handbook/nuxt',
  },
  defaults: { prefix: '', temporal: 'temporal-polyfill/global' },
  async setup({ prefix, temporal }, nuxt) {
    for (const entry of entryNames()) {
      const from = `${PACKAGE_NAME}/${entry}`;
      const exports: Record<string, object> = await import(
        new URL(`./${entry}/index.js`, import.meta.url).href
      );
      for (const [name, value] of Object.entries(exports)) {
        if (typeof value === 'function') {
          addImports({ name, as: name.replace(/^use/, `use${prefix}`), from });
        } else if (isComponent(value)) {
          addComponent({ name: `${prefix}${name}`, export: name, filePath: from });
        } else {
          addImports({ name, as: `${prefix}${name}`, from });
          addParts(entry, name, value as Record<string, object>, prefix);
        }
      }
    }
    if (temporal && (await tryResolveModule(temporal, directoryToURL(nuxt.options.rootDir)))) {
      addTemporalPlugin(temporal, nuxt);
    }
  },
});

export default nuxtModule;
