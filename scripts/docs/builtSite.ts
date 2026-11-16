import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPOSITORY_ROOT } from '../parity/repository.ts';

// The root package does not depend on VitePress, Playwright or axe-core. The release job `stage`
// installs the root dependencies in a step that can get an OIDC token.
const docsRequire = createRequire(join(REPOSITORY_ROOT, 'docs/package.json'));

/** Loads a package of `packages/vue`, such as Playwright. */
export const vueRequire = createRequire(join(REPOSITORY_ROOT, 'packages/vue/package.json'));

/** Serves `docs/.vitepress/dist`, as `pnpm docs:preview` does. Run `pnpm docs:build` first. */
export async function serveBuiltSite(): Promise<{ origin: string; close: () => void }> {
  const vitepress = await import(pathToFileURL(docsRequire.resolve('vitepress')).href);
  const server = await vitepress.serve({ root: join(REPOSITORY_ROOT, 'docs'), port: 0 });
  return {
    origin: `http://127.0.0.1:${String(server.server.address().port)}`,
    close: () => server.server.close(),
  };
}
