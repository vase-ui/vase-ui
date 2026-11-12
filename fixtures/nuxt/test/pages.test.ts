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

async function readAttributes(locator: Locator, names: string[]) {
  const values = await Promise.all(names.map((name) => locator.getAttribute(name)));
  return Object.fromEntries(names.map((name, index) => [name, values[index]]));
}

async function readElement(locator: Locator, names: string[]) {
  return {
    tag: await locator.evaluate((element) => element.localName),
    text: await locator.textContent(),
    attributes: await readAttributes(locator, names),
  };
}

async function expectButtonPage(page: Page) {
  const names = ['type', 'tabindex', 'disabled', 'aria-disabled', 'data-disabled', 'role'];
  const read = (testId: string) => readAttributes(page.getByTestId(testId), names);

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
  const names = ['role', 'aria-orientation', 'data-orientation', 'class'];

  expect(await readAttributes(page.getByTestId('separator'), names)).toEqual({
    role: 'separator',
    'aria-orientation': 'vertical',
    'data-orientation': 'vertical',
    class: 'divider',
  });
}

async function expectCurrencyRoot(page: Page) {
  const names = [
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
  expect(await readAttributes(page.getByTestId('currency-root'), names)).toEqual({
    role: 'progressbar',
    'aria-valuemin': '1000',
    'aria-valuemax': '5000',
    'aria-valuenow': '2000',
    'aria-valuetext': CURRENCY_TEXT,
    'aria-labelledby': labelId,
    'data-progressing': '',
  });
  expect(await page.getByTestId('currency-value').textContent()).toBe(CURRENCY_TEXT);
  expect(
    await page
      .getByTestId('currency-indicator')
      .evaluate((element) => (element as HTMLElement).style.width),
  ).toBe('25%');
}

async function expectProgressPage(page: Page) {
  await expectCurrencyRoot(page);
  expect(await page.getByTestId('percent-value').textContent()).toBe(PERCENT_TEXT);
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
  const names = ['role', 'data-tone', 'class', 'href'];

  expect(await readElement(page.getByTestId('default-tag'), names)).toEqual({
    tag: 'p',
    text: 'Default tag',
    attributes: { role: 'note', 'data-tone': 'info', class: 'highlight', href: null },
  });
  expect(await readElement(page.getByTestId('as-tag'), names)).toEqual({
    tag: 'section',
    text: 'As tag',
    attributes: { role: 'note', 'data-tone': 'warning', class: null, href: null },
  });
  expect(await readElement(page.getByTestId('render-slot'), names)).toEqual({
    tag: 'a',
    text: 'Render slot',
    attributes: { role: 'note', 'data-tone': 'info', class: null, href: '/button' },
  });
  expect(await page.getByTestId('merged').getAttribute('class')).toBe('second first');
  expect(await page.getByTestId('names').locator('li').allTextContents()).toEqual([]);
}

const PAGES = [
  { path: '/button', expectPage: expectButtonPage },
  { path: '/separator', expectPage: expectSeparatorPage },
  { path: '/progress', expectPage: expectProgressPage },
  { path: '/providers', expectPage: expectProvidersPage },
  { path: '/use-render', expectPage: expectUseRenderPage },
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

  it('formats a value with the locale of the visitor after hydration', async () => {
    const page = await createPage(undefined, { locale: 'de-DE' });
    const messages = collectMessages(page);

    await page.goto(url('/progress'), { waitUntil: 'hydration' });
    await waitForTwoFrames(page);

    const visitorText = await page.evaluate(() =>
      new Intl.NumberFormat(undefined, { style: 'percent' }).format(0.42),
    );
    expect(visitorText).not.toBe(PERCENT_TEXT);
    expect(await page.getByTestId('percent-value').textContent()).toBe(visitorText);
    await expectCurrencyRoot(page);
    expect(messages).toEqual([]);
  });

  it('runs the handlers of mergeProps from the rightmost set after hydration', async () => {
    const page = await createPage('/use-render');
    const names = page.getByTestId('names').locator('li');

    expect(await names.allTextContents()).toEqual([]);
    await page.getByTestId('merged').click();
    expect(await names.allTextContents()).toEqual(['second', 'first']);
  });
});
