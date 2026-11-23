import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import type { CDPSession, Page } from 'playwright';
import { hydrationApp, libraryApp, SERVER_RENDER_ERROR_FILE } from './build.ts';
import { installDriver, type Action, type Condition } from './harness/driver.ts';
import type { TimeResults } from './results.ts';
import {
  browserTypeOf,
  machine,
  PLAYWRIGHT_VERSION,
  readResults,
  reasonOf,
  startPreview,
  textOf,
  timeout,
  writeResults,
} from './runner.ts';
import {
  FILTER,
  LIBRARIES,
  LONG_LIST_OPTIONS,
  metricOf,
  MOUNT_INSTANCES,
  SETUPS,
  VISITS,
  type Library,
  type Measure,
  type Setup,
  type Visit,
} from './scenarios.ts';

const CPU_THROTTLE = 4;
/** The untimed open and close pairs before the timed ones. */
const WARM_UP_PAIRS = 5;
/**
 * A visit that takes longer fails, so that one fault does not stop the job. In the slowest library,
 * the six opens of a list of 1,000 options take more than a minute on `ubuntu-latest`.
 */
const VISIT_TIMEOUT = 180_000;

function measure(page: Page, action: Action, condition: Condition): Promise<number> {
  return page.evaluate(
    ([pageAction, pageCondition]) => window.benchmarkDriver.measure(pageAction, pageCondition),
    [action, condition] as const,
  );
}

/** Closes the popup with a real Escape press. The time starts at the `keydown` event. */
async function close(page: Page): Promise<number> {
  // The time of a close depends on the point of the frame at the press: about 5 ms or about 17 ms.
  // Each press starts after two frames, so each close starts at the same point.
  await page.evaluate(() => window.benchmarkDriver.nextFrames());
  await page.evaluate(() => {
    window.benchmarkDriver.measureNextKeydown({ kind: 'closed' });
  });
  await page.keyboard.press('Escape');
  return page.evaluate(() => window.benchmarkDriver.keydownMeasure());
}

/**
 * Opens the popup from a closed state. Dialog and Popover open with a click on the trigger. Menu
 * and Select open with ArrowDown on the focused trigger, and Combobox with ArrowDown on the focused
 * input.
 */
async function open(page: Page, scenario: string): Promise<number> {
  if (scenario === 'Dialog' || scenario === 'Popover') {
    return measure(page, { kind: 'click' }, { kind: 'open' });
  }
  await page.evaluate<void, 'input' | 'trigger'>(
    (target) => window.benchmarkDriver.focus(target),
    scenario === 'Combobox' ? 'input' : 'trigger',
  );
  // A Combobox can open when its input gets the focus. Then a real Escape press closes it, so
  // that the timed ArrowDown opens the popup of each library from the same state.
  if (await page.evaluate(() => window.benchmarkDriver.isOpen())) {
    await close(page);
  }
  return measure(page, { kind: 'arrowDown' }, { kind: 'open' });
}

async function openAndCloseToWarmUp(page: Page, scenario: string): Promise<void> {
  for (let pair = 0; pair < WARM_UP_PAIRS; pair++) {
    await open(page, scenario);
    await close(page);
  }
}

async function usedHeap(cdp: CDPSession): Promise<number> {
  await cdp.send('HeapProfiler.collectGarbage');
  const { usedSize } = await cdp.send('Runtime.getHeapUsage');
  return usedSize;
}

/** The address of the page of a visit, from the folder `dist`. */
function pathOf(visit: Visit, setup: Setup, library: Library): string {
  const app = `${setup.id}/${library.id}/${visit.scenario}/`;
  switch (visit.kind) {
    case 'mount':
      return `${app}?count=${String(MOUNT_INSTANCES)}&manual`;
    case 'popup':
      return app;
    case 'list':
      return `${app}?options=${String(LONG_LIST_OPTIONS)}`;
    case 'hydration':
      return `hydration/${setup.id}/${library.id}/?manual`;
  }
}

/** Runs the steps of a visit on a loaded page. */
async function runSteps(
  page: Page,
  cdp: CDPSession | undefined,
  visit: Visit,
): Promise<Partial<Record<Measure, number>>> {
  const { scenario } = visit;
  switch (visit.kind) {
    case 'mount': {
      const heapBefore = cdp && (await usedHeap(cdp));
      const mount = await measure(
        page,
        { kind: 'start' },
        { kind: 'instances', count: MOUNT_INSTANCES },
      );
      return cdp && heapBefore !== undefined
        ? { mount, heap: (await usedHeap(cdp)) - heapBefore }
        : { mount };
    }
    case 'popup': {
      await openAndCloseToWarmUp(page, scenario);
      return { open: await open(page, scenario), close: await close(page) };
    }
    case 'list': {
      await openAndCloseToWarmUp(page, scenario);
      const openLong = await open(page, scenario);
      const highlight = await measure(page, { kind: 'arrowDown' }, { kind: 'highlight' });
      if (scenario !== 'Combobox') {
        return { openLong, highlight };
      }
      const filter = await measure(
        page,
        { kind: 'type', text: FILTER.text },
        { kind: 'options', count: FILTER.options },
      );
      return { openLong, highlight, filter };
    }
    case 'hydration':
      return { hydrate: await measure(page, { kind: 'start' }, { kind: 'hydrated' }) };
  }
}

function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other] as T, result[index] as T];
  }
  return result;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      engine: { type: 'string', default: 'chromium' },
      setup: { type: 'string', default: 'vdom' },
      rounds: { type: 'string', default: '30' },
    },
  });
  const engine = values.engine;
  const browserType = browserTypeOf(engine);
  const setup = SETUPS.find((item) => item.id === values.setup && item.framework === 'vue');
  if (setup === undefined) {
    throw new Error(`--setup is vdom or vapor-interop, not ${values.setup}.`);
  }
  const rounds = Number(values.rounds);
  // Base UI is the reference from React: its samples go with those of the virtual DOM app.
  const libraries = LIBRARIES.filter(
    (library) => library.framework === 'vue' || setup.id === 'vdom',
  );
  const reactSetup = SETUPS.find((item) => item.framework === 'react');
  const setupOf = (library: Library): Setup =>
    library.framework === 'react' && reactSetup ? reactSetup : setup;
  const hasCdp = engine === 'chromium';

  /** The page of each library for each visit, or a reason that the cell has no samples. */
  const cells = new Map<Visit, Map<Library, { path: string } | { failed: string } | null>>();
  const metrics: TimeResults['metrics'] = {};
  for (const visit of VISITS) {
    const visitCells = new Map<Library, { path: string } | { failed: string } | null>();
    for (const library of libraries) {
      const librarySetup = setupOf(library);
      const app =
        visit.kind === 'hydration'
          ? hydrationApp(librarySetup, library)
          : libraryApp(librarySetup, library, visit.scenario);
      const serverError = app && join(app.outDir, SERVER_RENDER_ERROR_FILE);
      visitCells.set(
        library,
        app === undefined
          ? null
          : serverError !== undefined && existsSync(serverError)
            ? { failed: readFileSync(serverError, 'utf8') }
            : { path: pathOf(visit, librarySetup, library) },
      );
    }
    cells.set(visit, visitCells);
    for (const measureName of visit.measures) {
      if (measureName === 'heap' && !hasCdp) {
        continue;
      }
      metrics[metricOf(visit.scenario, measureName)] = Object.fromEntries(
        libraries.map((library) => {
          const cell = visitCells.get(library);
          return [
            library.id,
            cell === null || cell === undefined ? null : 'failed' in cell ? cell : [],
          ];
        }),
      );
    }
  }

  const server = await startPreview();
  const browser = await browserType.launch();
  const part: TimeResults = {
    browserVersion: browser.version(),
    playwright: PLAYWRIGHT_VERSION,
    machine: machine(),
    cpuThrottle: hasCdp ? CPU_THROTTLE : null,
    rounds: 0,
    metrics,
  };

  /** Runs one visit of one library in a new context, and gives its measures. */
  async function sample(visit: Visit, path: string): Promise<Partial<Record<Measure, number>>> {
    const context = await browser.newContext();
    const limit = timeout(VISIT_TIMEOUT);
    try {
      await context.addInitScript(installDriver);
      const page = await context.newPage();
      const messages: Promise<string>[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') {
          messages.push(textOf(message));
        }
      });
      page.on('pageerror', (error) => messages.push(Promise.resolve(error.message)));
      const run = async () => {
        await page.goto(new URL(path, server.origin).href);
        if (!(await page.evaluate(() => crossOriginIsolated))) {
          throw new Error('The page is not cross-origin isolated.');
        }
        await page.evaluate(() => window.benchmarkDriver.nextFrames());
        const cdp = hasCdp ? await context.newCDPSession(page) : undefined;
        await cdp?.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
        return runSteps(page, cdp, visit);
      };
      const measures = await Promise.race([run(), limit.promise]);
      const [message] = await Promise.all(messages);
      if (message !== undefined) {
        throw new Error(message);
      }
      return measures;
    } finally {
      limit.clear();
      await context.close();
    }
  }

  try {
    for (let round = 1; round <= rounds; round++) {
      const roundStart = performance.now();
      for (const visit of VISITS) {
        const visitCells = cells.get(visit);
        for (const library of shuffled(libraries)) {
          const cell = visitCells?.get(library);
          if (cell === null || cell === undefined || 'failed' in cell) {
            continue;
          }
          try {
            const measures = await sample(visit, cell.path);
            for (const [measureName, value] of Object.entries(measures)) {
              const samples =
                metrics[metricOf(visit.scenario, measureName as Measure)]?.[library.id];
              if (Array.isArray(samples)) {
                samples.push(measureName === 'heap' ? value : Math.round(value * 100) / 100);
              }
            }
          } catch (error) {
            const failed = { failed: reasonOf(error) };
            console.log(`${visit.scenario} ${visit.kind}, ${library.id}: ${failed.failed}`);
            visitCells?.set(library, failed);
            for (const measureName of visit.measures) {
              const metric = metrics[metricOf(visit.scenario, measureName)];
              if (metric) {
                metric[library.id] = failed;
              }
            }
          }
        }
      }
      part.rounds = round;
      const results = readResults();
      const time = results.time as Record<string, Record<string, TimeResults>> | undefined;
      writeResults({
        ...results,
        time: { ...time, [engine]: { ...time?.[engine], [setup.id]: part } },
      });
      console.log(
        `Round ${String(round)} of ${String(rounds)}: ${String(Math.round((performance.now() - roundStart) / 1000))} s`,
      );
    }
  } finally {
    await browser.close();
    await server.close();
  }
}

if (import.meta.main) {
  await main();
}
