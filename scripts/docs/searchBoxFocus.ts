import { serveBuiltSite, vueRequire } from './builtSite.ts';

// The Tab key of a browser can skip a control of the box. Firefox skips a link when its preference
// `accessibility.tabfocus` does not include the value 4. On macOS, WebKit skips a link, and it
// skips a button while full keyboard access is off. WebKit thus runs only on macOS.
const ENGINES = ['chromium', 'firefox', ...(process.platform === 'darwin' ? ['webkit'] : [])];

const BOX = '.VPLocalSearchBox';
const FIELD = `${BOX} .search-input`;
const SELECTED_RESULT = `${BOX} .result.selected`;
const SEARCH_TEXT = 'Quick start';

interface Locator {
  click(options?: { modifiers: ['ControlOrMeta'] }): Promise<void>;
  count(): Promise<number>;
  nth(index: number): Locator;
  focus(): Promise<void>;
  fill(text: string): Promise<void>;
  getAttribute(name: string): Promise<string | null>;
  waitFor(options?: { state: 'detached' }): Promise<void>;
  evaluate<Result, Argument = undefined>(
    read: (element: PageElement, argument: Argument) => Result,
    argument?: Argument,
  ): Promise<Result>;
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
  selectionStart?: number | null;
  selectionEnd?: number | null;
  getAttribute(name: string): string | null;
  dispatchEvent(event: object): boolean;
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
declare const KeyboardEvent: new (type: string, init: Record<string, unknown>) => object;

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
    await tab.locator(FIELD).fill(SEARCH_TEXT);
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

/**
 * The box moves the focus for a Tab key between two controls, and focus-trap moves it from the last
 * control to the first one. Each direction thus has one full turn.
 */
const tabThroughEachControl =
  ({ backButton }: { backButton: boolean }): Case =>
  async (tab, open) => {
    await open('/quick-start');
    await openFromButton(tab);
    const field = tab.locator(FIELD);
    await field.fill(SEARCH_TEXT);
    await tab.locator(SELECTED_RESULT).waitFor();
    const results = tab.locator(`${BOX} .result`);
    const resultCount = await results.count();
    if (resultCount < 2) {
      return 'the search needs two results or more for the order between results.';
    }
    const beforeField = backButton
      ? [{ target: tab.locator(`${BOX} .back-button`), name: 'the back button' }]
      : [];
    const controls = [
      ...beforeField,
      { target: field, name: 'the search field' },
      { target: tab.locator(`${BOX} .clear-button`), name: 'the reset button' },
      ...Array.from({ length: resultCount }, (_, index) => ({
        target: results.nth(index),
        name: `result ${String(index + 1)}`,
      })),
    ];
    for (const { key, direction } of [
      { key: 'Tab', direction: 1 },
      { key: 'Shift+Tab', direction: -1 },
    ]) {
      // `fill` puts the cursor after the text, so the selection below comes from the Tab key.
      await field.fill(SEARCH_TEXT);
      for (let step = 1; step <= controls.length; step++) {
        await tab.keyboard.press(key);
        const control =
          controls[(beforeField.length + direction * step + controls.length) % controls.length];
        const problem = await focusOn(tab, control.target, control.name);
        if (problem !== undefined) {
          return `${key}, step ${String(step)}: ${problem}`;
        }
      }
      const selection = await field.evaluate((element) => [
        element.selectionStart,
        element.selectionEnd,
      ]);
      if (selection[0] !== 0 || selection[1] !== SEARCH_TEXT.length) {
        return `${key} does not select the text of the search field when the focus returns to it.`;
      }
    }
    return undefined;
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
      await tab.locator(FIELD).fill(SEARCH_TEXT);
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
    name: 'Tab and Shift+Tab move the focus through each control of a wide box',
    width: 1440,
    run: tabThroughEachControl({ backButton: false }),
  },
  {
    // The back button shows at this width.
    name: 'Tab and Shift+Tab move the focus through each control of a narrow box',
    width: 390,
    run: tabThroughEachControl({ backButton: true }),
  },
  {
    // The case sends the events. A real Tab key with Control can change the tab of the browser, and
    // a test cannot start an input method.
    name: 'the box leaves a Tab key with Alt, Control or Meta, or in a composition, to the browser',
    width: 1440,
    run: async (tab, open) => {
      await open('/quick-start');
      await openFromButton(tab);
      const field = tab.locator(FIELD);
      await field.fill(SEARCH_TEXT);
      await tab.locator(SELECTED_RESULT).waitFor();
      for (const flag of ['altKey', 'ctrlKey', 'metaKey', 'isComposing']) {
        const canceled = await field.evaluate(
          (element, init) => !element.dispatchEvent(new KeyboardEvent('keydown', init)),
          { key: 'Tab', [flag]: true, bubbles: true, cancelable: true },
        );
        if (canceled) {
          return `the box cancels a Tab key with ${flag}.`;
        }
        const problem = await focusOn(tab, field, 'the search field');
        if (problem !== undefined) {
          return `after a Tab key with ${flag}, ${problem}`;
        }
      }
      return undefined;
    },
  },
];

async function main(): Promise<void> {
  const playwright = vueRequire('playwright');
  const site = await serveBuiltSite();
  const problems: string[] = [];

  try {
    for (const engine of ENGINES) {
      const browser = await playwright[engine].launch(
        engine === 'firefox' ? { firefoxUserPrefs: { 'accessibility.tabfocus': 1 } } : {},
      );
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
  console.log(`The search box keeps the focus in ${new Intl.ListFormat('en').format(ENGINES)}.`);
}

await main();
