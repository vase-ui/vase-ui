import { resolve } from 'node:path';
import type { BrowserCommand } from 'vitest/node';
import type * as RenderToHtml from './renderToHtml.ts';
import { probeWrite, takeLoopDelayMax } from './probe.ts';

/**
 * A Vitest browser command. It renders a component in the Vitest process, which is Node with no DOM.
 * The module graph of that process compiles a Vue file for a server.
 * `file` is a path from the root of the project.
 */
export const renderOnServer: BrowserCommand<
  [file: string, props?: Record<string, unknown>, marks?: unknown[]]
> = async ({ project, sessionId }, file, props, marks) => {
  const entered = Date.now();
  for (const m of marks ?? []) {
    probeWrite({ kind: 'mark', sessionId, nodeAt: entered, ...(m as object) });
  }
  const loopDelayBefore = takeLoopDelayMax();
  const runner = (
    project as unknown as {
      runner: { evaluatedModules?: { idToModuleMap?: Map<unknown, unknown> } };
    }
  ).runner;
  const modulesBefore = runner.evaluatedModules?.idToModuleMap?.size ?? 0;
  const { renderToHtml } = await project.import<typeof RenderToHtml>(
    resolve(project.config.root, 'test/server/renderToHtml.ts'),
  );
  const imported = Date.now();
  const result = await renderToHtml(resolve(project.config.root, file), props);
  const done = Date.now();
  probeWrite({
    kind: 'node-command',
    sessionId,
    browser: project.config.browser.name,
    file,
    entered,
    importRenderer: imported - entered,
    importDemo: result.times.importDemo,
    renderToString: result.times.renderToString,
    newModules: (runner.evaluatedModules?.idToModuleMap?.size ?? 0) - modulesBefore,
    loopDelayBefore,
    loopDelayDuring: takeLoopDelayMax(),
    heapMB: Math.round(process.memoryUsage().heapUsed / 2 ** 20),
    rssMB: Math.round(process.memoryUsage().rss / 2 ** 20),
    returned: done,
  });
  return { html: result.html, warnings: result.warnings };
};
