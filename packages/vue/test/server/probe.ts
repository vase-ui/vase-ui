// TEMPORARY PROBE of the hydration stall. Not for commit.
import { appendFileSync } from 'node:fs';
import { monitorEventLoopDelay, PerformanceObserver, performance } from 'node:perf_hooks';
import type { BrowserCommand } from 'vitest/node';

const file = process.env.PROBE_FILE;

export function probeWrite(record: Record<string, unknown>) {
  if (file) {
    appendFileSync(file, `${JSON.stringify(record)}\n`);
  }
}

// The longest block of the Node event loop since the last read, in ms.
const loopDelay = monitorEventLoopDelay({ resolution: 10 });
loopDelay.enable();
export function takeLoopDelayMax() {
  const max = loopDelay.max / 1e6;
  loopDelay.reset();
  return Math.round(max);
}

const gcObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration >= 50) {
      probeWrite({
        kind: 'node-gc',
        at: Math.round(performance.timeOrigin + entry.startTime),
        ms: Math.round(entry.duration),
        gcKind: (entry as unknown as { detail?: { kind?: number } }).detail?.kind,
        heapMB: Math.round(process.memoryUsage().heapUsed / 2 ** 20),
      });
    }
  }
});
gcObserver.observe({ entryTypes: ['gc'] });

export const probeLog: BrowserCommand<[record: Record<string, unknown>]> = (_context, record) => {
  const nodeAt = Date.now();
  probeWrite({ kind: 'browser', nodeAt, ...record });
  return { nodeAt };
};
