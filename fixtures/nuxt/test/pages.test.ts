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
}

async function expectFieldsetPage(page: Page) {
  const legendId = await page.getByTestId('legend').getAttribute('id');

  expect(legendId).toBeTruthy();
  expect(await page.getByTestId('fieldset').getAttribute('aria-labelledby')).toBe(legendId);
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

const PAGES = [
  { path: '/button', expectPage: expectButtonPage },
  { path: '/separator', expectPage: expectSeparatorPage },
  ...RANGE_PAGES.map(({ path, rootAttributes }) => ({
    path,
    expectPage: (page: Page) => expectRangePage(page, rootAttributes),
  })),
  { path: '/fieldset', expectPage: expectFieldsetPage },
  { path: '/collapsible', expectPage: expectCollapsiblePage },
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

  it.each(PAGES)('hydrates $path with no message', async ({ path, expectPage }) => {
    const page = await createPage();
    const messages = collectMessages(page);

    await page.goto(url(path), { waitUntil: 'hydration' });
    await waitForTwoFrames(page);

    expect(messages).toEqual([]);
    await expectPage(page);
  });

  it('counts the clicks on a button after hydration', async () => {
    const page = await createPage('/button');
    const counter = page.getByTestId('counter');

    expect(await counter.textContent()).toBe('Count 0');
    await counter.click();
    expect(await counter.textContent()).toBe('Count 1');
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
