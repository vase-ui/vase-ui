import { serveBuiltSite, vueRequire } from './builtSite.ts';

// On macOS, the Tab key of WebKit skips a link, and it skips a button while full keyboard access is
// off. Only that engine shows the Tab fault of the search box, and CI runs on Linux.
const ENGINES = process.platform === 'darwin' ? ['chromium', 'webkit'] : ['chromium'];

const BOX = '.VPLocalSearchBox';
const FIELD = `${BOX} .search-input`;
const SELECTED_RESULT = `${BOX} .result.selected`;

interface Locator {
  click(options?: { modifiers: ['ControlOrMeta'] }): Promise<void>;
  first(): Locator;
  focus(): Promise<void>;
  fill(text: string): Promise<void>;
  getAttribute(name: string): Promise<string | null>;
  waitFor(options?: { state: 'detached' }): Promise<void>;
  evaluate<Result>(read: (element: PageElement) => Result): Promise<Result>;
  evaluateAll<Result>(read: (elements: PageElement[]) => Result): Promise<Result>;
}

interface Tab {
  goto(address: string, options: { waitUntil: 'load' }): Promise<unknown>;
  keyboard: { press(key: string): Promise<void> };
  locator(selector: string): Locator;
  evaluate<Result>(read: () => Result | Promise<Result>): Promise<Result>;
  waitForFunction(read: () => boolean): Promise<unknown>;
}

interface PageElement {
  localName: string;
  id: string;
  getAttribute(name: string): string | null;
}

interface ElementName {
  localName: string;
  id: string;
  classes: string;
}

/** A case returns the problem that it found. */
type Case = (tab: Tab, open: (page: string) => Promise<void>) => Promise<string | undefined>;

// The functions that run in the page read these globals. The root project has no DOM types.
declare const document: {
  activeElement: PageElement | null;
  querySelector(selector: string): (object & { __vue_app__?: unknown }) | null;
};
declare function requestAnimationFrame(callback: () => void): number;

// The trap can return the focus only to an element that takes the focus, so a case opens the box
// from the search button.
async function openFromButton(tab: Tab): Promise<Locator> {
  const button = tab.locator('.VPNavBarSearchButton');
  await button.focus();
  await tab.keyboard.press('Enter');
  return button;
}

function describeElement({ localName, id, classes }: ElementName): string {
  const [firstClass = ''] = classes.split(' ');
  return `${localName}${id && `#${id}`}${firstClass && `.${firstClass}`}`;
}

async function focusOn(tab: Tab, target: Locator, name: string): Promise<string | undefined> {
  if (await target.evaluate((element) => element === document.activeElement)) {
    return undefined;
  }
  const active = await tab.evaluate(() => {
    const element = document.activeElement;
    return (
      element && {
        localName: element.localName,
        id: element.id,
        classes: element.getAttribute('class') ?? '',
      }
    );
  });
  return `the focus is on ${active ? describeElement(active) : 'no element'}, not on ${name}.`;
}

/** focus-trap moves the focus in a timer. A timer that starts later ends later. */
async function laterTimer(tab: Tab): Promise<void> {
  await tab.evaluate(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      }),
  );
}

/**
 * The router of VitePress moves the focus to a heading in an animation frame, and focus-trap
 * returns the focus in a timer. The read thus waits for a later frame and then for a later timer.
 */
async function focusAfterClose(
  tab: Tab,
  target: Locator,
  name: string,
): Promise<string | undefined> {
  await tab.locator(BOX).waitFor({ state: 'detached' });
  await tab.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          resolve();
        });
      }),
  );
  await laterTimer(tab);
  return focusOn(tab, target, name);
}

const resultOfOpenPage =
  (action: 'Enter' | 'click'): Case =>
  async (tab, open) => {
    await open('/quick-start');
    await openFromButton(tab);
    await tab.locator(FIELD).fill('Quick start');
    const address = (await tab.locator(SELECTED_RESULT).getAttribute('href')) ?? '';
    const [page = '', heading = ''] = address.split('#');
    // The box keeps the text of the search for the session, so the page of the result shows the
    // same result first.
    await open(page);
    await openFromButton(tab);
    await tab.locator(`${BOX} .result.selected[href="${address}"]`).waitFor();
    await (action === 'Enter' ? tab.keyboard.press('Enter') : tab.locator(SELECTED_RESULT).click());
    return focusAfterClose(tab, tab.locator(`[id="${heading}"]`), `the heading #${heading}`);
  };

const CASES: { name: string; width: number; run: Case }[] = [
  {
    name: 'Escape returns the focus to the search button',
    width: 1440,
    run: async (tab, open) => {
      await open('/quick-start');
      const button = await openFromButton(tab);
      await tab.locator(FIELD).waitFor();
      await tab.keyboard.press('Escape');
      return focusAfterClose(tab, button, 'the search button');
    },
  },
  {
    name: 'Escape returns the focus to the element that had it before the shortcut',
    width: 1440,
    run: async (tab, open) => {
      await open('/quick-start');
      const link = tab.locator('.VPSidebar a[href$="/components/dialog"]');
      await link.focus();
      await tab.keyboard.press('Control+k');
      await tab.locator(FIELD).waitFor();
      await tab.keyboard.press('Escape');
      return focusAfterClose(tab, link, 'the sidebar link');
    },
  },
  {
    name: 'Enter on a result of the open page puts the focus on its heading',
    width: 1440,
    run: resultOfOpenPage('Enter'),
  },
  {
    name: 'a click on a result of the open page puts the focus on its heading',
    width: 1440,
    run: resultOfOpenPage('click'),
  },
  {
    // The router of VitePress does not take a click with a modifier key. The browser opens the
    // result in another tab, and this page only closes the box.
    name: 'a click with a modifier key on a result returns the focus to the search button',
    width: 1440,
    run: async (tab, open) => {
      await open('/quick-start');
      const button = await openFromButton(tab);
      await tab.locator(FIELD).fill('Quick start');
      await tab.locator(SELECTED_RESULT).click({ modifiers: ['ControlOrMeta'] });
      return focusAfterClose(tab, button, 'the search button');
    },
  },
  {
    // The back button is before the field at this width.
    name: 'the search field has the focus when the box opens',
    width: 390,
    run: async (tab, open) => {
      await open('/quick-start');
      await tab.keyboard.press('Control+k');
      const field = tab.locator(FIELD);
      await field.waitFor();
      await laterTimer(tab);
      return focusOn(tab, field, 'the search field');
    },
  },
  {
    // WebKit on macOS keeps a link or a button in the Tab sequence when it has `tabindex`.
    name: 'each button and each link of the box has tabindex="0"',
    width: 1440,
    run: async (tab, open) => {
      await open('/quick-start');
      await tab.keyboard.press('Control+k');
      await tab.locator(FIELD).fill('Quick start');
      await tab.locator(SELECTED_RESULT).waitFor();
      const withoutTabindex = await tab.locator(`${BOX} :is(button, a)`).evaluateAll((controls) =>
        controls
          .filter((control) => control.getAttribute('tabindex') !== '0')
          .map((control) => ({
            localName: control.localName,
            id: control.id,
            classes: control.getAttribute('class') ?? '',
          })),
      );
      const names = [...new Set(withoutTabindex.map(describeElement))];
      return names.length > 0 ? `these controls do not have it: ${names.join(', ')}.` : undefined;
    },
  },
  {
    name: 'Tab moves the focus to the reset button and then to the first result',
    width: 1440,
    run: async (tab, open) => {
      await open('/quick-start');
      await tab.keyboard.press('Control+k');
      await tab.locator(FIELD).fill('Quick start');
      await tab.locator(SELECTED_RESULT).waitFor();
      await tab.keyboard.press('Tab');
      const problem = await focusOn(tab, tab.locator(`${BOX} .clear-button`), 'the reset button');
      if (problem !== undefined) {
        return problem;
      }
      await tab.keyboard.press('Tab');
      return focusOn(tab, tab.locator(`${BOX} .result`).first(), 'the first result');
    },
  },
];

async function main(): Promise<void> {
  const playwright = vueRequire('playwright');
  const site = await serveBuiltSite();
  const problems: string[] = [];

  try {
    for (const engine of ENGINES) {
      const browser = await playwright[engine].launch();
      try {
        for (const { name, width, run } of CASES) {
          const context = await browser.newContext({ viewport: { width, height: 900 } });
          try {
            const tab: Tab = await context.newPage();
            const problem = await run(tab, async (page) => {
              await tab.goto(`${site.origin}${page}`, { waitUntil: 'load' });
              // Vue sets `__vue_app__` on the root when it has hydrated the page.
              await tab.waitForFunction(
                () => document.querySelector('#app')?.__vue_app__ !== undefined,
              );
            });
            if (problem !== undefined) {
              problems.push(`${engine}: ${name}: ${problem}`);
            }
          } catch (error) {
            problems.push(`${engine}: ${name}: ${String(error)}`);
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
  console.log(`The search box keeps the focus in ${ENGINES.join(' and ')}.`);
}

await main();
