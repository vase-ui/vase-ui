import { playwright } from '@vitest/browser-playwright';
import { createServer, type InlineConfig, type ViteDevServer } from 'vite';
import type { BrowserCommand } from 'vitest/node';

/** Chromium, Firefox and WebKit. Each name starts with `project`, when one is given. */
export const browserInstances = (project?: string) => [
  { browser: 'chromium' as const, name: nameIn(project, 'chromium') },
  {
    browser: 'firefox' as const,
    name: nameIn(project, 'firefox'),
    provider: playwright({
      launchOptions: {
        firefoxUserPrefs: {
          // Vitest sets this preference to `true`. With that value, Firefox sometimes
          // crashes a page when the page starts.
          'dom.multiple_import_maps.enabled': false,
        },
      },
    }),
  },
  { browser: 'webkit' as const, name: nameIn(project, 'webkit') },
];

function nameIn(project: string | undefined, browser: string) {
  return project ? `${project} (${browser})` : browser;
}

/**
 * The command `renderOnServer`: it renders a fixture of `test/fixtures` to HTML in Node, with the
 * server build of each module. Its Vite server runs the ES module builds of Vue, so that `config`
 * can give `vue` an alias.
 */
export function serverRenderCommands(config: InlineConfig) {
  let server: Promise<ViteDevServer> | undefined;
  const renderOnServer: BrowserCommand<[fixture: string, props: Record<string, unknown>]> = async (
    { project },
    fixture,
    props,
  ) => {
    if (!/^[A-Za-z]+$/.test(fixture)) throw new Error(`There is no fixture "${fixture}".`);
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
    const load = (id: string) => vite.ssrLoadModule(id);
    const { createSSRApp } = await load('vue');
    const { renderToString } = await load('vue/server-renderer');
    const { default: component } = await load(`/test/fixtures/${fixture}.vue`);
    return renderToString(createSSRApp(component, props));
  };
  return { renderOnServer };
}
