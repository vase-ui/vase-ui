// What `time.ts` and `behavior.ts` share: the browsers, the server of `dist`, the machine, the
// reasons of a failed page and the file of the results.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import { join } from 'node:path';
import { chromium, firefox, webkit, type BrowserType, type ConsoleMessage } from 'playwright';
import { preview } from 'vite';
import type { TimeResults } from './results.ts';

const ENGINES = { chromium, firefox, webkit };
const RESULTS_FILE = join(import.meta.dirname, 'results.json');

const require = createRequire(import.meta.url);

export const PLAYWRIGHT_VERSION = (require('playwright/package.json') as { version: string })
  .version;

export function browserTypeOf(engine: string): BrowserType {
  if (!(engine in ENGINES)) {
    throw new Error(`--engine is chromium, firefox or webkit, not ${engine}.`);
  }
  return ENGINES[engine as keyof typeof ENGINES];
}

/** Serves `dist` on a free port of the loopback address. */
export async function startPreview(): Promise<{ origin: string; close: () => Promise<void> }> {
  const server = await preview({
    configFile: false,
    root: import.meta.dirname,
    logLevel: 'warn',
    appType: 'mpa',
    build: { outDir: 'dist' },
    preview: {
      host: '127.0.0.1',
      port: 0,
      // With cross-origin isolation, `performance.now()` has steps of 5 microseconds in Chromium and
      // 20 in Firefox and WebKit. Without it, the steps are 100 and 1,000.
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
  });
  const origin = server.resolvedUrls?.local[0];
  if (origin === undefined) {
    throw new Error('The preview server has no address.');
  }
  return { origin, close: () => server.close() };
}

/**
 * The text of a console message. For an `Error` object, Firefox gives only the text `Error`, so the
 * text comes from the object in the page. A page that is closed gives the text of Playwright.
 */
export async function textOf(message: ConsoleMessage): Promise<string> {
  const error = await message
    .args()[0]
    ?.evaluate((value) => (value instanceof Error ? String(value) : undefined))
    .catch(() => undefined);
  return error ?? message.text();
}

export function timeout(milliseconds: number): { promise: Promise<never>; clear: () => void } {
  let timer: NodeJS.Timeout | undefined;
  const promise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`The visit took more than ${String(milliseconds / 1000)} s.`));
    }, milliseconds);
  });
  return { promise, clear: () => clearTimeout(timer) };
}

/** The first line of the message of an error, with no prefix of Playwright. */
export function reasonOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return (message.split('\n')[0] ?? '')
    .replace(/^(?:page|locator|mouse|keyboard)\.\w+: /, '')
    .replace(/^Error: /, '');
}

export function machine(): TimeResults['machine'] {
  return {
    os: `${os.type()} ${os.release()}`,
    cpu: os.cpus()[0]?.model ?? '',
    cores: os.availableParallelism(),
    memory: os.totalmem(),
  };
}

export function readResults(): Record<string, unknown> {
  return existsSync(RESULTS_FILE)
    ? (JSON.parse(readFileSync(RESULTS_FILE, 'utf8')) as Record<string, unknown>)
    : {};
}

export function writeResults(results: Record<string, unknown>): void {
  writeFileSync(RESULTS_FILE, `${JSON.stringify(results, null, 2)}\n`);
}
