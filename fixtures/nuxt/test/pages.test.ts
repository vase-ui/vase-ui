import { fileURLToPath } from 'node:url';
import { clearServerLogs, createPage, getServerLogs, setup, url } from '@nuxt/test-utils/e2e';
import type { Locator, Page } from 'playwright-core';
import { describe, expect, it } from 'vitest';
import nuxtConfig from '../nuxt.config';

const rootDir = fileURLToPath(new URL('..', import.meta.url));

const CURRENCY_TEXT = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(
  2000,
);
// The server cannot know the locale of the visitor, so it formats the value with `en-US`.
const PERCENT_TEXT = new Intl.NumberFormat('en-US', { style: 'percent' }).format(0.42);

interface RangeRootAttributes {
  role: string;
  'data-progressing': string | null;
}

const RANGE_PAGES: { path: string; rootAttributes: RangeRootAttributes }[] = [
  { path: '/progress', rootAttributes: { role: 'progressbar', 'data-progressing': '' } },
  { path: '/meter', rootAttributes: { role: 'meter', 'data-progressing': null } },
];

async function readAttributes(locator: Locator, attributeNames: string[]) {
  const values = await Promise.all(attributeNames.map((name) => locator.getAttribute(name)));
  return Object.fromEntries(attributeNames.map((name, index) => [name, values[index]]));
}

async function readElement(locator: Locator, attributeNames: string[]) {
  return {
    tag: await locator.evaluate((element) => element.localName),
    text: await locator.textContent(),
    attributes: await readAttributes(locator, attributeNames),
  };
}

async function expectButtonPage(page: Page) {
  const attributeNames = ['type', 'tabindex', 'disabled', 'aria-disabled', 'data-disabled', 'role'];
  const read = (testId: string) => readAttributes(page.getByTestId(testId), attributeNames);

  expect(await page.getByTestId('counter').textContent()).toBe('Count 0');
  expect(await read('counter')).toEqual({
    type: 'button',
    tabindex: '0',
    disabled: null,
    'aria-disabled': null,
    'data-disabled': null,
    role: null,
  });
  expect(await read('disabled')).toEqual({
    type: 'button',
    tabindex: '0',
    disabled: '',
    'aria-disabled': null,
    'data-disabled': '',
    role: null,
  });
  expect(await read('focusable')).toEqual({
    type: 'button',
    tabindex: '0',
    disabled: null,
    'aria-disabled': 'true',
    'data-disabled': '',
    role: null,
  });
  expect(await read('span')).toEqual({
    type: null,
    tabindex: '0',
    disabled: null,
    'aria-disabled': null,
    'data-disabled': null,
    role: 'button',
  });
}

async function expectSeparatorPage(page: Page) {
  const attributeNames = ['role', 'aria-orientation', 'data-orientation', 'class'];

  expect(await readAttributes(page.getByTestId('separator'), attributeNames)).toEqual({
    role: 'separator',
    'aria-orientation': 'vertical',
    'data-orientation': 'vertical',
    class: 'divider',
  });
}

async function expectCurrencyRoot(page: Page, rootAttributes: RangeRootAttributes) {
  const attributeNames = [
    'role',
    'aria-valuemin',
    'aria-valuemax',
    'aria-valuenow',
    'aria-valuetext',
    'aria-labelledby',
    'data-progressing',
  ];
  const labelId = await page.getByTestId('currency-label').getAttribute('id');

  expect(labelId).toBeTruthy();
  expect(await readAttributes(page.getByTestId('currency-root'), attributeNames)).toEqual({
    ...rootAttributes,
    'aria-valuemin': '1000',
    'aria-valuemax': '5000',
    'aria-valuenow': '2000',
    'aria-valuetext': CURRENCY_TEXT,
    'aria-labelledby': labelId,
  });
  expect(await page.getByTestId('currency-value').textContent()).toBe(CURRENCY_TEXT);
  expect(
    await page
      .getByTestId('currency-indicator')
      .evaluate((element) => (element as HTMLElement).style.width),
  ).toBe('25%');
}

async function expectRangePage(page: Page, rootAttributes: RangeRootAttributes) {
  await expectCurrencyRoot(page, rootAttributes);
  expect(await page.getByTestId('percent-value').textContent()).toBe(PERCENT_TEXT);
  expect(await page.getByTestId('percent-root').getAttribute('aria-labelledby')).toBeNull();
}

async function expectFieldsetPage(page: Page) {
  const legendId = await page.getByTestId('legend').getAttribute('id');

  expect(legendId).toBeTruthy();
  expect(await page.getByTestId('fieldset').getAttribute('aria-labelledby')).toBe(legendId);
  expect(await page.getByTestId('named-fieldset').getAttribute('aria-labelledby')).toBeNull();
}

// The server HTML has the form with `novalidate` and the input with its value.
async function expectFormPage(page: Page) {
  expect(await readAttributes(page.getByTestId('form'), ['novalidate'])).toEqual({
    novalidate: '',
  });
  expect(await page.getByTestId('form').evaluate((element) => element.localName)).toBe('form');
  expect(await page.getByTestId('email').getAttribute('value')).toBe('a@b.c');
  expect(await page.getByTestId('output').textContent()).toBe('');
}

async function expectCollapsiblePage(page: Page) {
  const triggerAttributeNames = ['aria-expanded', 'aria-controls', 'data-panel-open'];
  const panelAttributeNames = ['hidden', 'data-open', 'data-closed'];
  const readTrigger = (testId: string) =>
    readAttributes(page.getByTestId(testId), triggerAttributeNames);
  const readPanel = (testId: string) =>
    readAttributes(page.getByTestId(testId), panelAttributeNames);
  // The trigger names the panel only while the panel is open.
  const closedTrigger = {
    'aria-expanded': 'false',
    'aria-controls': null,
    'data-panel-open': null,
  };

  expect(await readTrigger('closed-trigger')).toEqual(closedTrigger);
  expect(await page.getByTestId('closed-panel').count()).toBe(0);

  const openPanelId = await page.getByTestId('open-panel').getAttribute('id');
  expect(openPanelId).toBeTruthy();
  expect(await readTrigger('open-trigger')).toEqual({
    'aria-expanded': 'true',
    'aria-controls': openPanelId,
    'data-panel-open': '',
  });
  expect(await readPanel('open-panel')).toEqual({
    hidden: null,
    'data-open': '',
    'data-closed': null,
  });

  const untilFoundPanel = page.getByTestId('until-found-panel');
  expect(await readTrigger('until-found-trigger')).toEqual(closedTrigger);
  expect(await readPanel('until-found-panel')).toEqual({
    hidden: 'until-found',
    'data-open': null,
    'data-closed': '',
  });
  expect((await untilFoundPanel.textContent())?.trim()).toBe('Until found panel');

  const untilFoundPanelId = await untilFoundPanel.getAttribute('id');
  expect(untilFoundPanelId).toBeTruthy();
  expect(untilFoundPanelId).not.toBe(openPanelId);
}

async function expectAccordionPage(page: Page) {
  const triggerAttributeNames = ['aria-expanded', 'aria-controls', 'data-panel-open', 'data-index'];
  const panelAttributeNames = ['hidden', 'data-open', 'data-closed', 'role', 'data-index'];
  const readTrigger = (testId: string) =>
    readAttributes(page.getByTestId(testId), triggerAttributeNames);
  const readPanel = (testId: string) =>
    readAttributes(page.getByTestId(testId), panelAttributeNames);
  const readIds = async (name: string) => ({
    triggerId: await page.getByTestId(`${name}-trigger`).getAttribute('id'),
    labelledBy: await page.getByTestId(`${name}-panel`).getAttribute('aria-labelledby'),
    panelId: await page.getByTestId(`${name}-panel`).getAttribute('id'),
  });

  // The trigger names the panel only while the panel is open.
  expect(await readTrigger('closed-trigger')).toEqual({
    'aria-expanded': 'false',
    'aria-controls': null,
    'data-panel-open': null,
    'data-index': '0',
  });
  expect(await page.getByTestId('closed-panel').count()).toBe(0);

  const open = await readIds('open');
  expect(open.triggerId).toBeTruthy();
  expect(open.panelId).toBeTruthy();
  expect(open.labelledBy).toBe(open.triggerId);
  expect(await readTrigger('open-trigger')).toEqual({
    'aria-expanded': 'true',
    'aria-controls': open.panelId,
    'data-panel-open': '',
    'data-index': '1',
  });
  expect(await readPanel('open-panel')).toEqual({
    hidden: null,
    'data-open': '',
    'data-closed': null,
    role: 'region',
    'data-index': '1',
  });
  expect(await page.getByTestId('open-header').evaluate((element) => element.localName)).toBe('h3');

  const untilFound = await readIds('until-found');
  expect(untilFound.triggerId).toBeTruthy();
  expect(untilFound.triggerId).not.toBe(open.triggerId);
  expect(untilFound.labelledBy).toBe(untilFound.triggerId);
  expect(untilFound.panelId).toBeTruthy();
  expect(untilFound.panelId).not.toBe(open.panelId);
  expect(await readTrigger('until-found-trigger')).toEqual({
    'aria-expanded': 'false',
    'aria-controls': null,
    'data-panel-open': null,
    'data-index': '2',
  });
  expect(await readPanel('until-found-panel')).toEqual({
    hidden: 'until-found',
    'data-open': null,
    'data-closed': '',
    role: 'region',
    'data-index': '2',
  });
  expect((await page.getByTestId('until-found-panel').textContent())?.trim()).toBe(
    'Until found panel',
  );
}

// The server cannot know whether the image loads, so it renders the fallback and no image.
async function expectAvatarPageWithFallback(page: Page) {
  expect(await page.getByTestId('fallback').textContent()).toBe('LT');
  expect(await page.getByTestId('image').count()).toBe(0);
}

async function expectAvatarPageWithImage(page: Page) {
  await page.getByTestId('image').waitFor();
  expect(await page.getByTestId('fallback').count()).toBe(0);
}

// `from` is the button that has the tab stop after hydration.
const TOOLBARS = [
  { toolbar: 'plain', from: 'plain-1', to: 'plain-2' },
  { toolbar: 'disabled-first', from: 'disabled-first-2', to: 'disabled-first-3' },
  { toolbar: 'async', from: 'async-1', to: 'async-2' },
];

function readToolbarTabindexes(page: Page, toolbar: string) {
  return page
    .getByTestId(toolbar)
    .getByRole('button')
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('tabindex')));
}

// A server runs the `setup` of the first button of the toolbar `async` after the `setup` of the
// buttons that follow it. The server HTML then has the tab stop on the second button.
async function expectToolbarPage(page: Page) {
  expect(await readToolbarTabindexes(page, 'plain')).toEqual(['0', '-1', '-1']);
  expect(await readToolbarTabindexes(page, 'disabled-first')).toEqual(['-1', '0', '-1']);
  expect(await readToolbarTabindexes(page, 'async')).toEqual(['-1', '0', '-1']);
}

// After the mount, the tab stop is the first button that can get focus.
async function expectHydratedToolbarPage(page: Page) {
  expect(await readToolbarTabindexes(page, 'plain')).toEqual(['0', '-1', '-1']);
  expect(await readToolbarTabindexes(page, 'disabled-first')).toEqual(['-1', '0', '-1']);
  expect(await readToolbarTabindexes(page, 'async')).toEqual(['0', '-1', '-1']);
}

function readButtons(page: Page, testId: string, attributeName: string) {
  return page
    .getByTestId(testId)
    .getByRole('button')
    .evaluateAll(
      (buttons, name) => buttons.map((button) => button.getAttribute(name)),
      attributeName,
    );
}

// The tab stop of a group is its first toggle that is not disabled, also when another toggle is
// pressed. In a toolbar, the toggles are items of the toolbar, so the toolbar has one tab stop.
async function expectToggleGroupPage(page: Page) {
  expect(await page.getByTestId('alone').getAttribute('role')).toBe('group');
  expect(await readButtons(page, 'alone', 'tabindex')).toEqual(['0', '-1', '-1']);
  expect(await readButtons(page, 'alone', 'aria-pressed')).toEqual(['false', 'true', 'false']);
  expect(await readButtons(page, 'alone', 'data-pressed')).toEqual([null, '', null]);
  expect(await readButtons(page, 'disabled-first', 'tabindex')).toEqual(['-1', '0']);
  expect(await readButtons(page, 'in-toolbar', 'tabindex')).toEqual(['0', '-1', '-1']);
  expect(await readButtons(page, 'in-toolbar', 'aria-pressed')).toEqual([null, 'true', 'false']);
  expect(await readAttributes(page.getByTestId('single'), ['tabindex', 'aria-pressed'])).toEqual({
    tabindex: '0',
    'aria-pressed': 'true',
  });
}

function readDisableScrollbarStyles(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('style'))
      .filter((element) => element.textContent?.includes('.vase-ui-disable-scrollbar'))
      .map((element) => ({
        nonce: element.getAttribute('nonce'),
        parent: element.parentElement?.localName,
        parentTestId: element.parentElement?.getAttribute('data-testid'),
        isFirstChild: element.parentElement?.firstElementChild === element,
      })),
  );
}

// The server HTML has no measurement. So the corner is absent, and the viewport is out of the tab
// order. Each root holds its own style element, with the nonce of the provider.
async function expectScrollAreaPage(page: Page) {
  const style = { nonce: 'test-nonce', parent: 'div', isFirstChild: true };
  expect(await readDisableScrollbarStyles(page)).toEqual([
    { ...style, parentTestId: 'root' },
    { ...style, parentTestId: 'second-root' },
  ]);

  const viewportId = await page.getByTestId('viewport').getAttribute('data-id');
  const secondViewportId = await page.getByTestId('second-viewport').getAttribute('data-id');
  expect(viewportId).toMatch(/-viewport$/);
  expect(secondViewportId).toMatch(/-viewport$/);
  expect(secondViewportId).not.toBe(viewportId);
  expect(await page.getByTestId('scrollbar').getAttribute('data-id')).toBe(
    `${viewportId!.slice(0, -'viewport'.length)}scrollbar`,
  );
  expect(await readAttributes(page.getByTestId('viewport'), ['tabindex', 'class'])).toEqual({
    tabindex: '-1',
    class: 'vase-ui-disable-scrollbar',
  });
  expect(await page.getByTestId('corner').count()).toBe(0);
}

// After the mount, the roots share one style element in the head.
async function expectHydratedScrollAreaPage(page: Page) {
  await page.getByTestId('corner').waitFor();

  const styles = await readDisableScrollbarStyles(page);
  expect(styles).toHaveLength(1);
  expect(styles[0]).toMatchObject({ nonce: 'test-nonce', parent: 'head' });
  expect(await page.getByTestId('viewport').getAttribute('tabindex')).toBe('0');
}

async function expectFieldPage(page: Page) {
  const control = await readAttributes(page.getByTestId('control'), [
    'id',
    'name',
    'value',
    'data-filled',
  ]);

  expect(control.id).toBeTruthy();
  expect(control).toMatchObject({ name: 'name', value: 'foo', 'data-filled': '' });
  expect(
    await readAttributes(page.getByTestId('invalid-control'), ['data-invalid', 'aria-invalid']),
  ).toEqual({ 'data-invalid': '', 'aria-invalid': 'true' });
}

// The root of the field gets `data-filled` in the first render of the browser. The server HTML has
// it only on the control and on the parts after it.
async function expectHydratedFieldPage(page: Page) {
  await expectFieldPage(page);
  expect(await page.getByTestId('root').getAttribute('data-filled')).toBe('');
}

async function expectProvidersPage(page: Page) {
  expect(await page.getByTestId('outside').textContent()).toBe('ltr');
  expect(await page.getByTestId('inside').textContent()).toBe('rtl');
  expect(await page.getByTestId('button').getAttribute('type')).toBe('button');
  // A provider renders its slot and no element.
  expect(
    await page
      .getByTestId('providers')
      .locator(':scope > *')
      .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-testid'))),
  ).toEqual(['inside', 'button']);
}

async function expectUseRenderPage(page: Page) {
  const attributeNames = ['role', 'data-tone', 'class', 'href'];

  expect(await readElement(page.getByTestId('default-tag'), attributeNames)).toEqual({
    tag: 'p',
    text: 'Default tag',
    attributes: { role: 'note', 'data-tone': 'info', class: 'highlight', href: null },
  });
  expect(await readElement(page.getByTestId('as-tag'), attributeNames)).toEqual({
    tag: 'section',
    text: 'As tag',
    attributes: { role: 'note', 'data-tone': 'warning', class: null, href: null },
  });
  expect(await readElement(page.getByTestId('render-slot'), attributeNames)).toEqual({
    tag: 'a',
    text: 'Render slot',
    attributes: { role: 'note', 'data-tone': 'info', class: null, href: '/button' },
  });
  expect(await page.getByTestId('merged').getAttribute('class')).toBe('second first');
  expect(await page.getByTestId('calls').locator('li').allTextContents()).toEqual([]);
}

// The server renders `defaultMatches`. The default screen of the browser is wider than the query,
// so the value stays `true` after the mount.
async function expectMediaQueryPage(page: Page) {
  expect(await page.getByTestId('wide').textContent()).toBe('true');
}

async function readSwitchPage(page: Page) {
  const read = (testId: string) =>
    readAttributes(page.getByTestId(testId), [
      'role',
      'aria-checked',
      'data-checked',
      'aria-label',
    ]);

  return {
    notifications: await read('notifications'),
    thumb: await page.getByTestId('thumb').getAttribute('data-unchecked'),
    wifi: await read('wifi'),
    // The entries that a submit of the server HTML sends.
    formData: await page
      .getByTestId('form')
      .evaluate((form) =>
        Array.from(
          new FormData(form as HTMLFormElement),
          ([name, value]) => `${name}=${String(value)}`,
        ),
      ),
  };
}

async function expectSwitchPage(page: Page) {
  expect(await readSwitchPage(page)).toEqual({
    notifications: {
      role: 'switch',
      'aria-checked': 'false',
      'data-checked': null,
      'aria-label': null,
    },
    thumb: '',
    wifi: { role: 'switch', 'aria-checked': 'true', 'data-checked': '', 'aria-label': 'Wi-Fi' },
    formData: ['notifications=no', 'wifi=on'],
  });
  // A server has no DOM, so it cannot find a native label.
  expect(await page.getByTestId('notifications').getAttribute('aria-labelledby')).toBe(null);
}

async function expectHydratedSwitchPage(page: Page) {
  expect((await readSwitchPage(page)).formData).toEqual(['notifications=no', 'wifi=on']);
  const labelId = await page.getByTestId('label').getAttribute('id');
  expect(labelId).toBeTruthy();
  expect(await page.getByTestId('notifications').getAttribute('aria-labelledby')).toBe(labelId);
}

interface PageCase {
  path: string;
  expectPage: (page: Page) => Promise<void>;
  // For a page that changes after the mount. `expectPage` then holds for the server HTML only.
  expectHydratedPage?: (page: Page) => Promise<void>;
}

const PAGES: PageCase[] = [
  { path: '/button', expectPage: expectButtonPage },
  { path: '/separator', expectPage: expectSeparatorPage },
  ...RANGE_PAGES.map(({ path, rootAttributes }) => ({
    path,
    expectPage: (page: Page) => expectRangePage(page, rootAttributes),
  })),
  { path: '/fieldset', expectPage: expectFieldsetPage },
  { path: '/form', expectPage: expectFormPage },
  { path: '/collapsible', expectPage: expectCollapsiblePage },
  { path: '/accordion', expectPage: expectAccordionPage },
  {
    path: '/avatar',
    expectPage: expectAvatarPageWithFallback,
    expectHydratedPage: expectAvatarPageWithImage,
  },
  {
    path: '/toolbar',
    expectPage: expectToolbarPage,
    expectHydratedPage: expectHydratedToolbarPage,
  },
  { path: '/toggle-group', expectPage: expectToggleGroupPage },
  {
    path: '/switch',
    expectPage: expectSwitchPage,
    expectHydratedPage: expectHydratedSwitchPage,
  },
  {
    path: '/scroll-area',
    expectPage: expectScrollAreaPage,
    expectHydratedPage: expectHydratedScrollAreaPage,
  },
  { path: '/field', expectPage: expectFieldPage, expectHydratedPage: expectHydratedFieldPage },
  { path: '/providers', expectPage: expectProvidersPage },
  { path: '/use-render', expectPage: expectUseRenderPage },
  { path: '/unstable-use-media-query', expectPage: expectMediaQueryPage },
];

const MODES = [
  { name: 'a production build', dev: false },
  { name: 'the development server', dev: true },
];

function collectMessages(page: Page) {
  const messages: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') {
      messages.push(`console ${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    messages.push(`page error: ${error.message}`);
  });
  return messages;
}

function waitForTwoFrames(page: Page) {
  return page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

describe.each(MODES)('in $name', async ({ dev }) => {
  await setup({
    rootDir,
    browser: true,
    dev,
    // `setup` replaces the date of `nuxt.config.ts` with its own default date.
    nuxtConfig: { compatibilityDate: nuxtConfig.compatibilityDate },
  });

  it.each(PAGES)('renders $path on a server', async ({ path, expectPage }) => {
    const page = await createPage(undefined, { javaScriptEnabled: false });
    clearServerLogs();

    const response = await page.goto(url(path));

    expect(response?.status()).toBe(200);
    await expectPage(page);
    expect(getServerLogs().filter((line) => /\[Vue warn\]|Vase UI:/.test(line))).toEqual([]);
  });

  it.each(PAGES)(
    'hydrates $path with no message',
    async ({ path, expectPage, expectHydratedPage = expectPage }) => {
      const page = await createPage();
      const messages = collectMessages(page);

      await page.goto(url(path), { waitUntil: 'hydration' });
      await waitForTwoFrames(page);

      expect(messages).toEqual([]);
      await expectHydratedPage(page);
    },
  );

  it('changes a switch on a click on its label and on the switch after hydration', async () => {
    const page = await createPage('/switch');
    const messages = collectMessages(page);

    await page.getByTestId('label').click();
    await page.getByTestId('wifi').click();

    expect(await page.getByTestId('notifications').getAttribute('aria-checked')).toBe('true');
    expect(await page.getByTestId('wifi').getAttribute('aria-checked')).toBe('false');
    expect(await page.getByTestId('wifi-value').textContent()).toBe('false');
    expect((await readSwitchPage(page)).formData).toEqual(['notifications=on']);
    expect(messages).toEqual([]);
  });

  it('counts the clicks on a button after hydration', async () => {
    const page = await createPage('/button');
    const counter = page.getByTestId('counter');

    expect(await counter.textContent()).toBe('Count 0');
    await counter.click();
    expect(await counter.textContent()).toBe('Count 1');
  });

  it('gives the FormData of /form to the submit listener after hydration', async () => {
    const page = await createPage('/form');
    const messages = collectMessages(page);

    await page.getByTestId('submit').click();

    expect(await page.getByTestId('output').textContent()).toBe('a@b.c');
    expect(page.url()).toBe(url('/form'));
    expect(messages).toEqual([]);
  });

  it('moves the thumb of /scroll-area when its viewport scrolls after hydration', async () => {
    const page = await createPage('/scroll-area');
    const thumb = page.getByTestId('thumb');
    await page.getByTestId('corner').waitFor();
    const readTransform = () => thumb.evaluate((element) => element.style.transform);
    const initialTransform = await readTransform();

    await page.getByTestId('viewport').evaluate((element) => {
      element.scrollTop = 400;
    });
    await page.waitForFunction(
      ([testId, previous]) =>
        document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.style.transform !==
        previous,
      ['thumb', initialTransform],
    );

    const offsetY = Number(
      /^translate3d\(0px, ([\d.]+)px, 0px\)$/.exec(await readTransform())?.[1],
    );
    expect(offsetY).toBeGreaterThan(0);
  });

  it('opens a collapsible panel on a click on its trigger after hydration', async () => {
    const page = await createPage('/collapsible');
    const trigger = page.getByTestId('closed-trigger');
    const panel = page.getByTestId('closed-panel');

    expect(await panel.count()).toBe(0);
    await trigger.click();
    await panel.waitFor();

    const panelId = await panel.getAttribute('id');
    expect(panelId).toBeTruthy();
    expect(await readAttributes(trigger, ['aria-expanded', 'aria-controls'])).toEqual({
      'aria-expanded': 'true',
      'aria-controls': panelId,
    });
    expect(await panel.getAttribute('hidden')).toBeNull();
  });

  it('opens an accordion panel on a click on its trigger after hydration', async () => {
    const page = await createPage('/accordion');
    const trigger = page.getByTestId('closed-trigger');
    const panel = page.getByTestId('closed-panel');

    expect(await panel.count()).toBe(0);
    await trigger.click();
    await panel.waitFor();

    expect(await readAttributes(trigger, ['aria-expanded', 'aria-controls'])).toEqual({
      'aria-expanded': 'true',
      'aria-controls': await panel.getAttribute('id'),
    });
    expect(await panel.getAttribute('aria-labelledby')).toBe(await trigger.getAttribute('id'));
    // The root holds one value, so the open item closes.
    expect(await page.getByTestId('open-trigger').getAttribute('aria-expanded')).toBe('false');
  });

  it('moves the focus of the accordion with Tab and not with an arrow key after hydration', async () => {
    const page = await createPage('/accordion');
    const messages = collectMessages(page);
    const readFocus = () =>
      page.evaluate(() => document.activeElement?.getAttribute('data-testid'));

    await page.getByTestId('closed-trigger').focus();
    await page.keyboard.press('ArrowDown');
    expect(await readFocus()).toBe('closed-trigger');

    await page.keyboard.press('Tab');
    expect(await readFocus()).toBe('open-trigger');
    expect(messages).toEqual([]);
  });

  it.each(TOOLBARS)(
    'moves the focus of the toolbar $toolbar with an arrow key after hydration',
    async ({ from, to }) => {
      const page = await createPage('/toolbar');
      const messages = collectMessages(page);

      await page.getByTestId(from).focus();
      await page.keyboard.press('ArrowRight');

      expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe(
        to,
      );
      expect(await page.getByTestId(to).getAttribute('tabindex')).toBe('0');
      expect(await page.getByTestId(from).getAttribute('tabindex')).toBe('-1');
      expect(messages).toEqual([]);
    },
  );

  it('presses a toggle on a click and moves the focus of the group with an arrow key after hydration', async () => {
    const page = await createPage('/toggle-group');
    const messages = collectMessages(page);

    await page.getByTestId('alone-1').click();

    expect(await readButtons(page, 'alone', 'aria-pressed')).toEqual(['true', 'false', 'false']);
    expect(await page.getByTestId('alone-value').textContent()).toBe('left');

    await page.keyboard.press('ArrowRight');

    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe(
      'alone-2',
    );
    expect(await readButtons(page, 'alone', 'tabindex')).toEqual(['-1', '0', '-1']);
    expect(messages).toEqual([]);
  });

  it('moves the focus of a toolbar into its toggle group with an arrow key after hydration', async () => {
    const page = await createPage('/toggle-group');
    const messages = collectMessages(page);

    await page.getByTestId('in-toolbar-1').focus();
    await page.keyboard.press('ArrowRight');

    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe(
      'in-toolbar-2',
    );
    expect(await readButtons(page, 'in-toolbar', 'tabindex')).toEqual(['-1', '0', '-1']);
    expect(messages).toEqual([]);
  });

  it.each(RANGE_PAGES)(
    'formats a value of $path with the locale of the visitor after hydration',
    async ({ path, rootAttributes }) => {
      const page = await createPage(undefined, { locale: 'de-DE' });
      const messages = collectMessages(page);

      await page.goto(url(path), { waitUntil: 'hydration' });
      await waitForTwoFrames(page);

      const visitorText = await page.evaluate(() =>
        new Intl.NumberFormat(undefined, { style: 'percent' }).format(0.42),
      );
      expect(visitorText).not.toBe(PERCENT_TEXT);
      expect(await page.getByTestId('percent-value').textContent()).toBe(visitorText);
      await expectCurrencyRoot(page, rootAttributes);
      expect(messages).toEqual([]);
    },
  );

  it('shows the media query of the visitor after hydration', async () => {
    // The screen is narrower than the query, so the real value differs from `defaultMatches`.
    const page = await createPage(undefined, { viewport: { width: 400, height: 800 } });
    const messages = collectMessages(page);

    await page.goto(url('/unstable-use-media-query'), { waitUntil: 'hydration' });
    await waitForTwoFrames(page);

    expect(await page.getByTestId('wide').textContent()).toBe('false');
    expect(messages).toEqual([]);
  });

  it('runs the handlers of mergeProps from the rightmost set after hydration', async () => {
    const page = await createPage('/use-render');
    const calls = page.getByTestId('calls').locator('li');

    expect(await calls.allTextContents()).toEqual([]);
    await page.getByTestId('merged').click();
    expect(await calls.allTextContents()).toEqual(['second', 'first']);
  });
});
