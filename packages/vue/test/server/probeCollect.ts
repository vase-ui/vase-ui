// TEMPORARY PROBE of the hydration stall. A setup file that collects the garbage of the earlier test
// files before the first test of each file.
import { beforeAll } from 'vitest';

declare module 'vitest/browser' {
  interface BrowserCommands {
    collectGarbage: () => Promise<void>;
  }
}

if (typeof document !== 'undefined') {
  beforeAll(async () => {
    const { commands } = await import('vitest/browser');
    const started = Date.now();
    await commands.collectGarbage();
    await commands.probeLog({ phase: 'forced-gc', ms: Date.now() - started, file: location.href });
  });
}
