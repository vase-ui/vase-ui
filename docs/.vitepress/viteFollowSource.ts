import { posix, sep } from 'node:path';
import type { Plugin } from 'vitepress';
import { listFamilyPages } from '../../scripts/docs/familyPages.ts';

const TEST_FILE = /\.(?:test|spec)\./;

/**
 * Updates family pages after a source edit. The site imports the built package, so Vite does
 * not see the source files that supply the API reference.
 */
export function viteFollowSource(sourceRoot: string): Plugin {
  const sourcePrefix = `${sourceRoot.replaceAll(sep, '/')}/`;
  return {
    name: 'vase-ui:follow-source',
    configureServer({ watcher }) {
      watcher.add(sourceRoot);
    },
    hotUpdate({ file, modules }) {
      if (!file.startsWith(sourcePrefix) || TEST_FILE.test(posix.basename(file))) {
        return;
      }
      const { config, moduleGraph } = this.environment;
      const pages = listFamilyPages(config.root)
        .map(({ path }) => moduleGraph.getModuleById(posix.join(config.root, path)))
        .filter((page) => page !== undefined);
      // Vite keeps the result of a transform that is in progress at a hot update. A page transform
      // can read the reference for some seconds. Without this call, a page would not show a file
      // that changes in that time.
      for (const page of pages) {
        moduleGraph.invalidateModule(page);
      }
      return pages.length > 0 ? [...modules, ...pages] : undefined;
    },
  };
}
