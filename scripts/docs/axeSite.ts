import { readdirSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { DEMO_VARIANT_STORAGE_KEY } from '../../docs/.vitepress/components/demoVariantStorageKey.ts';
import { REPOSITORY_ROOT } from '../parity/repository.ts';
import { serveBuiltSite, vueRequire } from './builtSite.ts';
import { REDIRECTS } from './redirects.ts';

// 1440 is a desktop width: the site shows the sidebar and the outline. 320 is the width of the
// Reflow criterion of WCAG (1.4.10): the tables of the API reference scroll there.
const WIDTHS = [1440, 320];
// The site follows the color scheme of the browser until the reader selects a theme.
const THEMES = ['light', 'dark'] as const;
// Calendar demos follow the clock, so a fixed day keeps the audit the same on each day.
const TODAY = '2026-11-14';

/**
 * Each row is a fault that a page of the site has now, with its reason. The check does not report
 * it. Correct the fault and remove its row: the check fails while a row matches no violation.
 */
const KNOWN_FAULTS: { page: string; rule: string; reason: string }[] = [
  {
    page: '/404',
    rule: 'landmark-one-main',
    reason: 'The not-found layout of the default theme of VitePress has no main element.',
  },
  {
    page: '/404',
    rule: 'region',
    reason: 'The not-found layout of the default theme of VitePress has no main element.',
  },
];

type Theme = (typeof THEMES)[number];
type Variant = 'css-modules' | 'tailwind';

interface Violation {
  id: string;
  help: string;
  nodes: { target: string[]; html: string }[];
}

interface Run {
  page: string;
  width: number;
  theme: Theme;
  variant: Variant;
}

interface ConsoleMessage {
  type(): string;
  text(): string;
  location(): { url: string };
}

// The functions that run in the page read these globals. The root project has no DOM or Temporal
// types.
declare const document: {
  querySelector(selector: string): (object & { __vue_app__?: unknown }) | null;
  querySelectorAll(selector: string): Iterable<{ dataset: Record<string, string | undefined> }>;
  documentElement: { classList: { contains(name: string): boolean } };
  fonts: { ready: Promise<unknown> };
};
declare function requestAnimationFrame(callback: () => void): number;
declare const localStorage: { setItem(key: string, value: string): void };
declare const axe: {
  run(options: { resultTypes: string[] }): Promise<{ violations: Violation[] }>;
};
declare const Temporal: {
  PlainDate: { from(day: string): { toString(): string } };
  Now: { plainDateISO: () => { toString(): string } };
};

const DIST = join(REPOSITORY_ROOT, 'docs/.vitepress/dist');

/**
 * `components/dialog.html` is the page `/components/dialog`, as the site links it. The file of a
 * redirect is not a page of the site: it sends the reader to a page.
 */
function listPages(): string[] {
  const redirects = new Set(REDIRECTS.map(({ from }) => from));
  return readdirSync(DIST, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.html') && !file.startsWith('assets'))
    .map((file) => `/${file.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, '')}`)
    .filter((page) => !redirects.has(page))
    .sort();
}

async function main(): Promise<void> {
  const { chromium } = vueRequire('playwright');
  const axeSource: string = vueRequire('axe-core').source;

  const { origin, close } = await serveBuiltSite();
  const browser = await chromium.launch();
  const problems: string[] = [];
  const seenKnownFaults = new Set<(typeof KNOWN_FAULTS)[number]>();

  async function checkPage({
    page,
    width,
    theme,
    variant,
  }: Run): Promise<{ hasBothVariants: boolean }> {
    const name = `${page} (${theme}, ${String(width)}px, ${variant})`;
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      colorScheme: theme,
    });
    try {
      await context.addInitScript(
        ([key, value]: [string, string]) => {
          // The script also runs in the empty first document of the page, which has no storage.
          try {
            localStorage.setItem(key, value);
          } catch {
            // It runs again in the document of the page.
          }
        },
        [DEMO_VARIANT_STORAGE_KEY, variant],
      );
      await context.addInitScript((day: string) => {
        const date = Temporal.PlainDate.from(day);
        Temporal.Now.plainDateISO = () => date;
      }, TODAY);
      const tab = await context.newPage();
      tab.on('pageerror', (error: Error) => {
        problems.push(`${name}: the page threw ${String(error)}`);
      });
      // A production build of Vue does not throw an error of a component or a hydration mismatch.
      // It logs them with `console.error`. Some demos show images from other sites. The browser
      // logs a failed load with the address of the image, and the check does not test other sites.
      tab.on('console', (message: ConsoleMessage) => {
        if (message.type() === 'error' && message.location().url.startsWith(origin)) {
          problems.push(`${name}: the page logged the error ${message.text()}`);
        }
      });
      await tab.goto(`${origin}${page}`, { waitUntil: 'load' });
      // Vue sets `__vue_app__` on the root when it has hydrated the page. A frame shows the stored
      // styling method in the render after the mount, and fonts change the width of a table.
      await tab.waitForFunction(() => document.querySelector('#app')?.__vue_app__ !== undefined);
      const state: { dark: boolean; switchable: string[]; today: string } = await tab.evaluate(
        async () => {
          await document.fonts.ready;
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              requestAnimationFrame(resolve);
            });
          });
          return {
            dark: document.documentElement.classList.contains('dark'),
            // A frame with a toolbar has both styling methods.
            switchable: Array.from(
              document.querySelectorAll('.demo:has(> .demo-toolbar) > .demo-frame'),
              (frame) => frame.dataset.demo ?? '',
            ),
            today: Temporal.Now.plainDateISO().toString(),
          };
        },
      );
      if (state.dark !== (theme === 'dark')) {
        problems.push(`${name}: the page does not show the ${theme} theme.`);
      }
      if (state.switchable.some((shown) => shown !== variant)) {
        problems.push(`${name}: a demo frame does not show the ${variant} demo.`);
      }
      if (state.today !== TODAY) {
        problems.push(`${name}: the page does not have ${TODAY} as today (${state.today}).`);
      }
      await tab.addScriptTag({ content: axeSource });
      const violations: Violation[] = await tab.evaluate(async () => {
        const results = await axe.run({ resultTypes: ['violations'] });
        return results.violations.map(({ id, help, nodes }) => ({
          id,
          help,
          nodes: nodes.map(({ target, html }) => ({ target, html })),
        }));
      });
      for (const violation of violations) {
        const known = KNOWN_FAULTS.find((row) => row.page === page && row.rule === violation.id);
        if (known) {
          seenKnownFaults.add(known);
          continue;
        }
        problems.push(
          [
            `${name}: ${violation.id}: ${violation.help}`,
            ...violation.nodes.map(({ target, html }) => `  ${target.join(' ')}: ${html}`),
          ].join('\n'),
        );
      }
      return { hasBothVariants: state.switchable.length > 0 };
    } catch (error) {
      problems.push(`${name}: ${String(error)}`);
      return { hasBothVariants: false };
    } finally {
      await context.close();
    }
  }

  let runs = 0;
  const pages = listPages();
  const queue: Omit<Run, 'variant'>[] = pages.flatMap((page) =>
    WIDTHS.flatMap((width) => THEMES.map((theme) => ({ page, width, theme }))),
  );
  try {
    await Promise.all(
      Array.from({ length: availableParallelism() }, async () => {
        for (let run = queue.shift(); run; run = queue.shift()) {
          // A page with no demo in both styling methods shows the same page for each.
          const { hasBothVariants } = await checkPage({ ...run, variant: 'css-modules' });
          runs += 1;
          if (hasBothVariants) {
            await checkPage({ ...run, variant: 'tailwind' });
            runs += 1;
          }
        }
      }),
    );
  } finally {
    await browser.close();
    close();
  }

  for (const row of KNOWN_FAULTS) {
    if (!seenKnownFaults.has(row)) {
      problems.push(
        `${row.page}: no ${row.rule} violation. Remove its row from KNOWN_FAULTS in scripts/docs/axeSite.ts.`,
      );
    }
  }
  if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log(
    [
      `axe-core found no new violation on ${String(pages.length)} pages in ${String(runs)} runs.`,
      ...(KNOWN_FAULTS.length > 0 ? ['The check does not report these known faults:'] : []),
      ...KNOWN_FAULTS.map(({ page, rule, reason }) => `  ${page}: ${rule}: ${reason}`),
    ].join('\n'),
  );
}

await main();
