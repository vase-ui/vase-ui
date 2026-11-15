// TEMPORARY PROBE of the WebKit hydration cases. Not for commit.
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

// Vitest can load this module more than once in one process (the config and each project).
// The watchers of the whole process start one time.
const started = Symbol.for('vase-ui-probe-started');
if (!(globalThis as Record<symbol, unknown>)[started]) {
  (globalThis as Record<symbol, unknown>)[started] = true;
  // Aligns a CPU profile of this process (its times are microseconds of the monotonic clock) with
  // the wall clock of the records.
  probeWrite({
    kind: 'clock',
    at: Date.now(),
    monotonicUs: Number(process.hrtime.bigint() / 1000n),
    pid: process.pid,
  });


  // Each block of the Node event loop of 100 ms or more in the whole run, with its time. A browser
  // command (a real click, a server render) waits for the loop.
  let lastTick = performance.now();
  setInterval(() => {
    const now = performance.now();
    const late = now - lastTick - 20;
    if (late >= 100) {
      probeWrite({ kind: 'node-loop-block', at: Date.now(), ms: Math.round(late) });
    }
    lastTick = now;
  }, 20).unref();

  const gcObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration >= 20) {
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
}

export const probeLog: BrowserCommand<[record: Record<string, unknown>]> = (_context, record) => {
  const nodeAt = Date.now();
  probeWrite({ kind: 'browser', nodeAt, ...record });
  return { nodeAt };
};
