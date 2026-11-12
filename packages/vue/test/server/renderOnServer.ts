import { resolve } from 'node:path';
import type { BrowserCommand } from 'vitest/node';
import type * as RenderToHtml from './renderToHtml.ts';

/**
 * A Vitest browser command. It renders a component in the Vitest process, which is Node with no DOM.
 * The module graph of that process compiles a Vue file for a server.
 * `file` is a path from the root of the project.
 */
export const renderOnServer: BrowserCommand<
  [file: string, props?: Record<string, unknown>]
> = async ({ project }, file, props) => {
  const { renderToHtml } = await project.import<typeof RenderToHtml>(
    resolve(project.config.root, 'test/server/renderToHtml.ts'),
  );
  return renderToHtml(resolve(project.config.root, file), props);
};
