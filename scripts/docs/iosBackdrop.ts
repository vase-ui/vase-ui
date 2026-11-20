import { serveBuiltSite, vueRequire } from './builtSite.ts';

// Only Safari on iOS matches `@supports (-webkit-touch-callout: none)`. There, the backdrop of a
// demo is `position: absolute` with `min-height: 100dvh`. The check gives each such block a
// condition that each engine matches, in its place in the style sheet.
const ENGINES = ['chromium', 'firefox', 'webkit'];
const IOS_CONDITION = '-webkit-touch-callout';

// The hero demo of each page has a backdrop.
const PAGES = ['/components/dialog', '/components/alert-dialog', '/components/drawer'];
// The trigger is near the top of the view, so the page scrolls and the code blocks are below it.
const TRIGGER_TOP = 150;

interface Locator {
  first(): Locator;
  click(): Promise<void>;
  waitFor(): Promise<void>;
  evaluate<Result, Argument>(
    read: (element: PageElement, argument: Argument) => Result,
    argument: Argument,
  ): Promise<Result>;
}

interface Tab {
  goto(address: string, options: { waitUntil: 'load' }): Promise<unknown>;
  locator(selector: string): Locator;
  evaluate<Result, Argument>(
    read: (argument: Argument) => Result,
    argument: Argument,
  ): Promise<Result>;
  waitForFunction(read: () => boolean): Promise<unknown>;
}

interface PageElement {
  getBoundingClientRect(): { top: number };
}

interface RuleList {
  cssRules: ArrayLike<Rule>;
  deleteRule(index: number): void;
  insertRule(rule: string, index: number): number;
}

interface Rule extends Partial<RuleList> {
  cssText: string;
  conditionText?: string;
}

interface Box {
  getBoundingClientRect(): { top: number; bottom: number };
}

declare const document: {
  styleSheets: Iterable<RuleList>;
  querySelector(selector: string): (object & { __vue_app__?: unknown }) | null;
  querySelectorAll(selector: string): Iterable<Box>;
};
declare const window: { innerHeight: number; scrollBy(x: number, y: number): void };

/** The rectangles of the backdrops of the CSS Modules demos, against the height of the view. */
function backdropPlaces(): string[] {
  return [...document.querySelectorAll('body > [class*="_Backdrop_"]')].map((backdrop) => {
    const { top, bottom } = backdrop.getBoundingClientRect();
    return top <= 0 && bottom >= window.innerHeight
      ? 'covers'
      : `runs from ${String(Math.round(top))} to ${String(Math.round(bottom))} px in a view of ${String(window.innerHeight)} px`;
  });
}

async function check(tab: Tab, origin: string, page: string): Promise<string | undefined> {
  await tab.goto(`${origin}${page}`, { waitUntil: 'load' });
  // Vue sets `__vue_app__` on the root when it has hydrated the page.
  await tab.waitForFunction(() => document.querySelector('#app')?.__vue_app__ !== undefined);
  await tab.evaluate((condition) => {
    const enable = (list: RuleList) => {
      for (let index = 0; index < list.cssRules.length; index++) {
        const rule = list.cssRules[index];
        if (rule.cssText.startsWith('@supports') && rule.conditionText?.includes(condition)) {
          list.deleteRule(index);
          list.insertRule(rule.cssText.replace(rule.conditionText, '(display: block)'), index);
        } else if (rule.cssRules && rule.deleteRule && rule.insertRule) {
          enable(rule as RuleList);
        }
      }
    };
    for (const sheet of document.styleSheets) enable(sheet);
  }, IOS_CONDITION);
  const trigger = tab.locator('.vp-doc [aria-haspopup="dialog"]').first();
  await trigger.evaluate((element, top) => {
    window.scrollBy(0, element.getBoundingClientRect().top - top);
  }, TRIGGER_TOP);
  await trigger.click();
  await tab.locator('[role="dialog"], [role="alertdialog"]').first().waitFor();
  const places = await tab.evaluate(backdropPlaces, undefined);
  if (places.length !== 1) return `the open demo has ${String(places.length)} backdrops, not 1.`;
  return places[0] === 'covers'
    ? undefined
    : `with the page scrolled, the backdrop ${places[0]}. It must cover the view.`;
}

async function main(): Promise<void> {
  const playwright = vueRequire('playwright');
  const site = await serveBuiltSite();
  const problems: string[] = [];
  try {
    for (const engine of ENGINES) {
      const browser = await playwright[engine].launch();
      try {
        for (const page of PAGES) {
          // The width and the height of a phone.
          const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
          try {
            const problem = await check(await context.newPage(), site.origin, page);
            if (problem !== undefined) problems.push(`${engine}: ${page}: ${problem}`);
          } catch (error) {
            problems.push(`${engine}: ${page}: ${String(error)}`);
          } finally {
            await context.close();
          }
        }
      } finally {
        await browser.close();
      }
    }
  } finally {
    site.close();
  }
  if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log(
    `With the style sheets of iOS, the backdrop covers the view in ${new Intl.ListFormat('en').format(ENGINES)}.`,
  );
}

await main();
