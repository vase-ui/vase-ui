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
const EURO_FORMAT = { style: 'currency', currency: 'EUR' } as const;
const EURO_TEXT = new Intl.NumberFormat('en-US', EURO_FORMAT).format(1234.5);

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

// The label and the messages name the control in the server HTML, in each order of the parts.
async function expectLabelledField(page: Page, name: string) {
  const readId = (part: string) => page.getByTestId(`${name}-${part}`).getAttribute('id');
  const controlId = await readId('control');
  const labelId = await readId('label');

  expect(controlId).toBeTruthy();
  expect(labelId).toBeTruthy();
  expect(await page.getByTestId(`${name}-label`).getAttribute('for')).toBe(controlId);
  expect(
    await readAttributes(page.getByTestId(`${name}-control`), [
      'aria-labelledby',
      'aria-describedby',
    ]),
  ).toEqual({
    'aria-labelledby': labelId,
    'aria-describedby': `${await readId('description')} ${await readId('error')}`,
  });
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
  await expectLabelledField(page, 'label-first');
  await expectLabelledField(page, 'label-last');
}

// The root of the field gets `data-filled` in the first render of the browser. The server HTML has
// it only on the control and on the parts after it.
async function expectHydratedFieldPage(page: Page) {
  await expectFieldPage(page);
  expect(await page.getByTestId('root').getAttribute('data-filled')).toBe('');
}

const ACTIVE_TAB_VARIABLE_SUFFIXES = ['left', 'right', 'top', 'bottom', 'width', 'height'];

function readTabsRoot(page: Page, testId: string) {
  return page.getByTestId(testId).evaluate((root) => ({
    tabs: Array.from(root.querySelectorAll('[role="tab"]'), (tab) => ({
      id: tab.id,
      tabindex: tab.getAttribute('tabindex'),
      controls: tab.getAttribute('aria-controls'),
    })),
    panels: Array.from(root.querySelectorAll('[role="tabpanel"]'), (panel) => ({
      id: panel.id,
      labelledby: panel.getAttribute('aria-labelledby'),
    })),
  }));
}

function readActiveTabVariables(page: Page) {
  return page
    .getByTestId('indicator')
    .evaluate(
      (indicator, suffixes) =>
        Object.fromEntries(
          suffixes.map((suffix) => [
            suffix,
            indicator.style.getPropertyValue(`--active-tab-${suffix}`),
          ]),
        ),
      ACTIVE_TAB_VARIABLE_SUFFIXES,
    );
}

// Before hydration the inline script sets the variables. After it, the part sets them.
async function expectIndicatorUnderTab(
  page: Page,
  tabTestId: string,
  { left, right }: { left: string; right: string },
) {
  expect(await readActiveTabVariables(page)).toEqual({
    left,
    right,
    top: '0px',
    bottom: '0px',
    width: '100px',
    height: '40px',
  });
  expect(await page.getByTestId('indicator').boundingBox()).toEqual(
    await page.getByTestId(tabTestId).boundingBox(),
  );
}

// The server writes a part before it registers the parts that come after it. The part that comes
// first then has no id of the other part in the server HTML. It gets the id in the first flush on
// the client. Panel `a` is not mounted, so no tab names it.
async function expectTabIds(page: Page, { hydrated }: { hydrated: boolean }) {
  const after = await readTabsRoot(page, 'panels-after');
  const before = await readTabsRoot(page, 'panels-before');

  expect(after.tabs[1].id).toBeTruthy();
  expect(after.tabs.map((tab) => tab.tabindex)).toEqual(['-1', '0', '-1']);
  expect(before.tabs.map((tab) => tab.tabindex)).toEqual(['-1', '0']);
  expect(after.panels.map((panel) => panel.labelledby)).toEqual([
    after.tabs[1].id,
    after.tabs[2].id,
  ]);
  expect(after.tabs.map((tab) => tab.controls)).toEqual(
    hydrated ? [null, after.panels[0].id, after.panels[1].id] : [null, null, null],
  );
  expect(before.tabs.map((tab) => tab.controls)).toEqual([null, before.panels[0].id]);
  expect(before.panels.map((panel) => panel.labelledby)).toEqual([
    hydrated ? before.tabs[1].id : null,
  ]);
}

// The server cannot measure the layout, so the indicator is hidden and has no variable. The script
// after it has the nonce of the provider. It does not run here, because this page has no JavaScript.
async function expectTabsPage(page: Page) {
  await expectTabIds(page, { hydrated: false });

  expect(
    await page.locator('[role="tablist"] script').evaluateAll((scripts) =>
      scripts.map((script) => ({
        nonce: script.getAttribute('nonce'),
        follows: script.previousElementSibling?.getAttribute('data-testid'),
        hasText: script.textContent?.includes('currentScript'),
      })),
    ),
  ).toEqual([{ nonce: 'test-nonce', follows: 'indicator', hasText: true }]);
  expect(await readAttributes(page.getByTestId('indicator'), ['hidden', 'role'])).toEqual({
    hidden: '',
    role: 'presentation',
  });
  expect(await readActiveTabVariables(page)).toEqual(
    Object.fromEntries(ACTIVE_TAB_VARIABLE_SUFFIXES.map((suffix) => [suffix, ''])),
  );
}

async function expectHydratedTabsPage(page: Page) {
  await expectTabIds(page, { hydrated: true });

  expect(await page.locator('[role="tablist"] script').count()).toBe(0);
  await expectIndicatorUnderTab(page, 'tab-b', { left: '100px', right: '100px' });
}

async function expectInputPage(page: Page) {
  const input = await readAttributes(page.getByTestId('input'), [
    'id',
    'name',
    'value',
    'data-filled',
  ]);

  expect(input.id).toBeTruthy();
  expect(input).toMatchObject({ name: 'name', value: 'foo', 'data-filled': '' });
  expect(
    await readAttributes(page.getByTestId('invalid-input'), ['data-invalid', 'aria-invalid']),
  ).toEqual({ 'data-invalid': '', 'aria-invalid': 'true' });
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

// The attributes of an indicator, or `null` when the page has no element for it.
async function readIndicator(page: Page, testId: string, attributeNames: string[]) {
  const indicator = page.getByTestId(testId);
  if ((await indicator.count()) === 0) {
    return null;
  }

  return readAttributes(indicator, attributeNames);
}

const CHECKBOX_INDICATOR_ATTRIBUTES = ['data-checked', 'data-unchecked', 'data-indeterminate'];
const RADIO_INDICATOR_ATTRIBUTES = [
  'data-checked',
  'data-unchecked',
  'data-starting-style',
  'data-ending-style',
];

async function readCheckboxPage(page: Page) {
  const read = (testId: string) =>
    readAttributes(page.getByTestId(testId), [
      'role',
      'aria-checked',
      'data-checked',
      'data-indeterminate',
      'aria-label',
    ]);
  const form = page.getByTestId('form');

  return {
    terms: await read('terms'),
    news: await read('news'),
    some: await read('some'),
    indicators: {
      terms: await readIndicator(page, 'terms-indicator', CHECKBOX_INDICATOR_ATTRIBUTES),
      news: await readIndicator(page, 'news-indicator', CHECKBOX_INDICATOR_ATTRIBUTES),
      some: await readIndicator(page, 'some-indicator', CHECKBOX_INDICATOR_ATTRIBUTES),
      kept: await readIndicator(page, 'kept-indicator', CHECKBOX_INDICATOR_ATTRIBUTES),
    },
    // The entries that a submit of the server HTML sends.
    formData: await form.evaluate((element) =>
      Array.from(
        new FormData(element as HTMLFormElement),
        ([name, value]) => `${name}=${String(value)}`,
      ),
    ),
    indeterminate: await form.evaluate((element) =>
      Array.from(
        element.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
        (input) => input.indeterminate,
      ),
    ),
  };
}

async function expectCheckboxPage(page: Page) {
  expect(await readCheckboxPage(page)).toEqual({
    terms: {
      role: 'checkbox',
      'aria-checked': 'false',
      'data-checked': null,
      'data-indeterminate': null,
      'aria-label': null,
    },
    news: {
      role: 'checkbox',
      'aria-checked': 'true',
      'data-checked': '',
      'data-indeterminate': null,
      'aria-label': 'News',
    },
    some: {
      role: 'checkbox',
      'aria-checked': 'mixed',
      'data-checked': null,
      'data-indeterminate': '',
      'aria-label': 'Some',
    },
    indicators: {
      terms: null,
      news: { 'data-checked': '', 'data-unchecked': null, 'data-indeterminate': null },
      some: { 'data-checked': null, 'data-unchecked': null, 'data-indeterminate': '' },
      kept: { 'data-checked': null, 'data-unchecked': '', 'data-indeterminate': null },
    },
    formData: ['terms=no', 'news=on'],
    // HTML has no attribute for `indeterminate`, so a server cannot write it.
    indeterminate: [false, false, false, false],
  });
  // A server has no DOM, so it cannot find a native label.
  expect(await page.getByTestId('terms').getAttribute('aria-labelledby')).toBe(null);
}

async function expectHydratedCheckboxPage(page: Page) {
  const { formData, indeterminate } = await readCheckboxPage(page);
  expect(formData).toEqual(['terms=no', 'news=on']);
  expect(indeterminate).toEqual([false, false, true, false]);
  const labelId = await page.getByTestId('label').getAttribute('id');
  expect(labelId).toBeTruthy();
  expect(await page.getByTestId('terms').getAttribute('aria-labelledby')).toBe(labelId);
}

function readRadios(page: Page, testId: string, attributeName: string) {
  return page
    .getByTestId(testId)
    .locator('[role="radio"]')
    .evaluateAll((radios, name) => radios.map((radio) => radio.getAttribute(name)), attributeName);
}

// The entries that a submit of the form sends.
function readFormData(page: Page) {
  return page
    .getByTestId('form')
    .evaluate((form) =>
      Array.from(
        new FormData(form as HTMLFormElement),
        ([name, value]) => `${name}=${String(value)}`,
      ),
    );
}

// The tab stop is on the checked radio, or on the first radio that is not disabled when no radio is
// checked. The label comes after the group, and the server HTML names the group with it.
async function expectRadioGroupPage(page: Page) {
  const labelId = await page.getByTestId('label').getAttribute('id');
  expect(labelId).toBeTruthy();
  expect(await readAttributes(page.getByTestId('fruit'), ['role', 'aria-labelledby'])).toEqual({
    role: 'radiogroup',
    'aria-labelledby': labelId,
  });
  expect(await readRadios(page, 'fruit', 'aria-checked')).toEqual(['false', 'true', 'false']);
  expect(await readRadios(page, 'fruit', 'tabindex')).toEqual(['-1', '0', '-1']);
  expect(await readFormData(page)).toEqual(['fruit=banana']);
  // The indicator of a radio that is not checked has no element, unless it has `keepMounted`. No
  // indicator has a transition attribute, because a radio that is checked at the mount does not
  // animate in.
  expect({
    apple: await readIndicator(page, 'apple-indicator', RADIO_INDICATOR_ATTRIBUTES),
    banana: await readIndicator(page, 'banana-indicator', RADIO_INDICATOR_ATTRIBUTES),
    cherry: await readIndicator(page, 'cherry-indicator', RADIO_INDICATOR_ATTRIBUTES),
  }).toEqual({
    apple: null,
    banana: {
      'data-checked': '',
      'data-unchecked': null,
      'data-starting-style': null,
      'data-ending-style': null,
    },
    cherry: {
      'data-checked': null,
      'data-unchecked': '',
      'data-starting-style': null,
      'data-ending-style': null,
    },
  });

  expect(await readRadios(page, 'empty', 'aria-checked')).toEqual(['false', 'false', 'false']);
  expect(await readRadios(page, 'empty', 'tabindex')).toEqual(['-1', '0', '-1']);
}

const APPLE_TEST_IDS = ['fuji', 'gala', 'granny-smith'];

async function readCheckboxGroupPage(page: Page) {
  return {
    group: await readAttributes(page.getByTestId('group'), ['role', 'aria-labelledby']),
    parent: await readAttributes(page.getByTestId('parent'), [
      'aria-checked',
      'data-checked',
      'data-indeterminate',
      'data-parent',
      'aria-controls',
    ]),
    apples: await Promise.all(
      APPLE_TEST_IDS.map((testId) => page.getByTestId(testId).getAttribute('aria-checked')),
    ),
    formData: await readFormData(page),
    indeterminate: await page
      .getByTestId('form')
      .evaluate((form) =>
        Array.from(
          form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
          (input) => input.indeterminate,
        ),
      ),
  };
}

// The label comes after the group, and the server HTML names the group with it. A child gives its
// id after the mount, so the server HTML has no `aria-controls` on the parent. HTML has no
// attribute for `indeterminate`, so the input of the parent gets it after the mount. The input of
// the parent has no name, so the form gets the entries of the children only.
async function expectCheckboxGroupPage(page: Page, { hydrated }: { hydrated: boolean }) {
  const labelId = await page.getByTestId('label').getAttribute('id');
  const childIds = await Promise.all(
    APPLE_TEST_IDS.map((testId) => page.getByTestId(testId).getAttribute('id')),
  );

  expect(labelId).toBeTruthy();
  expect(await readCheckboxGroupPage(page)).toEqual({
    group: { role: 'group', 'aria-labelledby': labelId },
    parent: {
      'aria-checked': 'mixed',
      'data-checked': null,
      'data-indeterminate': '',
      'data-parent': '',
      'aria-controls': hydrated ? childIds.join(' ') : null,
    },
    apples: ['true', 'false', 'false'],
    formData: ['apples=fuji'],
    indeterminate: [hydrated, false, false, false],
  });
}

function readOTPSlots(page: Page, testId: string, attributeName: string) {
  return page
    .getByTestId(testId)
    .locator('input')
    .evaluateAll((inputs, name) => inputs.map((input) => input.getAttribute(name)), attributeName);
}

function readOTPSlotValues(page: Page, testId: string) {
  return page
    .getByTestId(testId)
    .locator('input')
    .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
}

// The label of the first field comes after the field, and the server HTML names the group and each
// slot with it. The first empty slot is the tab stop. Only the hidden input has a name.
async function expectOTPFieldPage(page: Page) {
  const labelId = await page.getByTestId('code-label').getAttribute('id');
  const firstSlotId = await page.getByTestId('code-1').getAttribute('id');
  expect(labelId).toBeTruthy();
  expect(firstSlotId).toBeTruthy();
  expect(await page.getByTestId('code-label').getAttribute('for')).toBe(firstSlotId);
  expect(await page.getByTestId('code').getAttribute('aria-labelledby')).toBe(labelId);
  expect(await readOTPSlots(page, 'code', 'aria-labelledby')).toEqual(Array(4).fill(labelId));
  expect(await readOTPSlotValues(page, 'code')).toEqual(['1', '2', '', '']);
  expect(await readOTPSlots(page, 'code', 'tabindex')).toEqual(['-1', '-1', '0', '-1']);
  expect(await readFormData(page)).toEqual(['code=12']);
  expect(await readOTPSlots(page, 'pin', 'type')).toEqual(Array(4).fill('password'));
  expect(await readOTPSlotValues(page, 'pin')).toEqual(['5', '6', '', '']);
}

async function expectOTPFieldPageOnServer(page: Page) {
  await expectOTPFieldPage(page);
  // A server has no DOM, so it cannot find a native label.
  expect(await page.getByTestId('pin').getAttribute('aria-labelledby')).toBe(null);
  expect(await readOTPSlots(page, 'pin', 'aria-labelledby')).toEqual(Array(4).fill(null));
}

async function expectHydratedOTPFieldPage(page: Page) {
  await expectOTPFieldPage(page);
  const labelId = await page.getByTestId('pin-label').getAttribute('id');
  expect(labelId).toBeTruthy();
  expect(await page.getByTestId('pin').getAttribute('aria-labelledby')).toBe(labelId);
  expect(await readOTPSlots(page, 'pin', 'aria-labelledby')).toEqual(Array(4).fill(labelId));
}

// The label and the messages name the input in the server HTML, in each order of the parts. The
// hidden input has the number and not the text.
async function expectNumberFieldPage(page: Page) {
  await expectLabelledField(page, 'label-first');
  await expectLabelledField(page, 'label-last');
  expect(await page.getByTestId('label-first-control').inputValue()).toBe(EURO_TEXT);
  expect(await page.getByTestId('label-last-control').inputValue()).toBe('7');
  expect(await readFormData(page)).toEqual(['amount=1234.5', 'quantity=7']);
}

// The portal renders after the mount, so the server HTML has no portal element.
async function expectPortalPageOnServer(page: Page) {
  expect(await page.getByTestId('trigger').count()).toBe(1);
  expect(await page.locator('[data-vase-ui-portal]').count()).toBe(0);
}

// After the mount, each portal element is in its container. A `null` container has none.
async function expectHydratedPortalPage(page: Page) {
  const readParent = (testId: string) =>
    page
      .getByTestId(testId)
      .evaluate((element) => element.parentElement?.id || element.parentElement?.localName);

  expect(await readParent('in-body')).toBe('body');
  expect(await readParent('in-page')).toBe('page');
  expect(await readParent('in-teleports')).toBe('teleports');
  expect(await page.getByTestId('no-container').count()).toBe(0);
  expect(await page.locator('[data-vase-ui-portal]').count()).toBe(3);
}

// A server renders no popup and no portal. The trigger of an open root has the open state. The
// trigger of a handle has the closed form, because a server attaches no store to a handle.
async function expectMenuPageOnServer(page: Page) {
  const attributeNames = ['aria-haspopup', 'aria-expanded', 'data-popup-open', 'data-pressed'];
  const read = (testId: string) => readAttributes(page.getByTestId(testId), attributeNames);

  expect(await read('closed')).toEqual({
    'aria-haspopup': 'menu',
    'aria-expanded': 'false',
    'data-popup-open': null,
    'data-pressed': null,
  });
  expect(await read('open')).toEqual({
    'aria-haspopup': 'menu',
    'aria-expanded': 'true',
    'data-popup-open': '',
    'data-pressed': '',
  });
  expect(await read('detached')).toEqual({
    'aria-haspopup': 'menu',
    'aria-expanded': null,
    'data-popup-open': null,
    'data-pressed': null,
  });
  expect(await page.locator('[data-vase-ui-portal], [role="menu"]').count()).toBe(0);
}

// After the mount, the open root renders its popup in `<body>`, and the trigger of the handle
// follows its root.
async function expectHydratedMenuPage(page: Page) {
  const popup = page.getByTestId('open-popup');
  expect(await popup.count()).toBe(1);
  expect(
    await popup.evaluate(
      (element) => element.closest('[data-vase-ui-portal]')?.parentElement?.localName,
    ),
  ).toBe('body');
  expect(await popup.getAttribute('role')).toBe('menu');
  expect(await popup.getAttribute('aria-labelledby')).toBe('open-trigger');
  expect(await popup.getAttribute('data-open')).toBe('');
  expect(await page.getByTestId('open').getAttribute('aria-controls')).toBe(
    await popup.getAttribute('id'),
  );
  expect(await popup.textContent()).toBe('Open popup');

  expect(await page.getByTestId('closed').getAttribute('aria-expanded')).toBe('false');
  expect(await page.getByTestId('detached').getAttribute('aria-expanded')).toBe('false');
  expect(await page.getByTestId('closed-popup').count()).toBe(0);
  expect(await page.getByTestId('detached-popup').count()).toBe(0);
}

// The server HTML has the label of the value before any item exists, the hidden inputs of the
// form, and no popup: a portal renders after the mount.
async function expectSelectPage(page: Page) {
  const triggerAttributes = ['id', 'role', 'aria-expanded', 'aria-haspopup', 'aria-labelledby'];
  expect(await readAttributes(page.getByTestId('font-trigger'), triggerAttributes)).toEqual({
    id: 'font',
    role: 'combobox',
    'aria-expanded': 'false',
    'aria-haspopup': 'listbox',
    'aria-labelledby': null,
  });
  expect(await page.getByTestId('font-value').textContent()).toBe('Serif');

  const labelId = await page.getByTestId('size-label').getAttribute('id');
  expect(labelId).toBeTruthy();
  expect(await page.getByTestId('size-trigger').getAttribute('aria-labelledby')).toBe(labelId);

  expect(await page.getByTestId('tags-value').textContent()).toBe('b');
  expect(await readFormData(page)).toEqual(['font=serif', 'size=', 'tags=b']);
  expect(await page.getByRole('listbox').count()).toBe(0);
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
    path: '/checkbox',
    expectPage: expectCheckboxPage,
    expectHydratedPage: expectHydratedCheckboxPage,
  },
  {
    path: '/checkbox-group',
    expectPage: (page) => expectCheckboxGroupPage(page, { hydrated: false }),
    expectHydratedPage: (page) => expectCheckboxGroupPage(page, { hydrated: true }),
  },
  { path: '/radio-group', expectPage: expectRadioGroupPage },
  {
    path: '/scroll-area',
    expectPage: expectScrollAreaPage,
    expectHydratedPage: expectHydratedScrollAreaPage,
  },
  { path: '/field', expectPage: expectFieldPage, expectHydratedPage: expectHydratedFieldPage },
  { path: '/tabs', expectPage: expectTabsPage, expectHydratedPage: expectHydratedTabsPage },
  { path: '/input', expectPage: expectInputPage },
  {
    path: '/otp-field',
    expectPage: expectOTPFieldPageOnServer,
    expectHydratedPage: expectHydratedOTPFieldPage,
  },
  { path: '/number-field', expectPage: expectNumberFieldPage },
  { path: '/providers', expectPage: expectProvidersPage },
  { path: '/use-render', expectPage: expectUseRenderPage },
  { path: '/unstable-use-media-query', expectPage: expectMediaQueryPage },
  {
    path: '/portal',
    expectPage: expectPortalPageOnServer,
    expectHydratedPage: expectHydratedPortalPage,
  },
  { path: '/menu', expectPage: expectMenuPageOnServer, expectHydratedPage: expectHydratedMenuPage },
  { path: '/select', expectPage: expectSelectPage },
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

  it('changes a checkbox on a click on its label and on the checkbox after hydration, and mounts and unmounts its indicator', async () => {
    const page = await createPage('/checkbox');
    const messages = collectMessages(page);

    await page.getByTestId('label').click();
    await page.getByTestId('news').click();
    await page.getByTestId('news-indicator').waitFor({ state: 'detached' });

    expect(await page.getByTestId('terms').getAttribute('aria-checked')).toBe('true');
    expect(await page.getByTestId('terms-indicator').getAttribute('data-checked')).toBe('');
    expect(await page.getByTestId('news').getAttribute('aria-checked')).toBe('false');
    expect(await page.getByTestId('news-value').textContent()).toBe('false');
    expect((await readCheckboxPage(page)).formData).toEqual(['terms=on']);
    expect(messages).toEqual([]);
  });

  it('selects a radio of /radio-group with a click and with an arrow key after hydration, and moves its indicator', async () => {
    const page = await createPage('/radio-group');
    const messages = collectMessages(page);
    const readFocusedTestId = () =>
      page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    const readRadioIndicator = (testId: string) =>
      readIndicator(page, testId, RADIO_INDICATOR_ATTRIBUTES);

    await page.getByTestId('apple').click();
    await page.getByTestId('banana-indicator').waitFor({ state: 'detached' });

    expect(await readRadios(page, 'fruit', 'aria-checked')).toEqual(['true', 'false', 'false']);
    expect(await readRadios(page, 'fruit', 'tabindex')).toEqual(['0', '-1', '-1']);
    expect(await readRadioIndicator('apple-indicator')).toMatchObject({ 'data-checked': '' });
    expect(await readRadioIndicator('cherry-indicator')).toMatchObject({ 'data-unchecked': '' });
    expect(await page.getByTestId('value').textContent()).toBe('apple');
    expect(await readFormData(page)).toEqual(['fruit=apple']);

    await page.keyboard.press('ArrowDown');
    await page.getByTestId('apple-indicator').waitFor({ state: 'detached' });

    expect(await readFocusedTestId()).toBe('banana');
    expect(await readRadios(page, 'fruit', 'aria-checked')).toEqual(['false', 'true', 'false']);
    expect(await readRadios(page, 'fruit', 'tabindex')).toEqual(['-1', '0', '-1']);
    expect(await readRadioIndicator('banana-indicator')).toMatchObject({ 'data-checked': '' });
    expect(await page.getByTestId('value').textContent()).toBe('banana');
    expect(await readFormData(page)).toEqual(['fruit=banana']);
    expect(messages).toEqual([]);
  });

  it('changes the checkboxes of /checkbox-group with three clicks on the parent and a click on a child after hydration', async () => {
    const page = await createPage('/checkbox-group');
    const messages = collectMessages(page);
    const expectSelection = async (parent: string, selected: string[]) => {
      expect(await readCheckboxGroupPage(page)).toMatchObject({
        parent: { 'aria-checked': parent },
        apples: APPLE_TEST_IDS.map((apple) => String(selected.includes(apple))),
        formData: selected.map((apple) => `apples=${apple}`),
      });
      expect(await page.getByTestId('value').textContent()).toBe(selected.join(','));
    };

    await page.getByTestId('parent').click();
    await expectSelection('true', ['fuji', 'gala', 'granny-smith']);

    await page.getByTestId('parent').click();
    await expectSelection('false', []);

    await page.getByTestId('parent').click();
    await expectSelection('mixed', ['fuji']);

    await page.getByTestId('gala').click();
    await expectSelection('mixed', ['fuji', 'gala']);
    expect(messages).toEqual([]);
  });

  it('changes the value of /number-field with typing after hydration, and formats the text on blur', async () => {
    const page = await createPage('/number-field');
    const messages = collectMessages(page);
    const control = page.getByTestId('label-first-control');

    await control.fill('42');

    expect(await page.getByTestId('amount-value').textContent()).toBe('42');
    expect(await readFormData(page)).toEqual(['amount=42', 'quantity=7']);

    await control.blur();

    expect(await control.inputValue()).toBe(new Intl.NumberFormat('en-US', EURO_FORMAT).format(42));
    expect(messages).toEqual([]);
  });

  it('opens the popup of /select in the body on a press after hydration, and selects an item', async () => {
    const page = await createPage('/select');
    const messages = collectMessages(page);

    await page.getByTestId('font-trigger').click();
    const popup = page.getByTestId('font-popup');
    await popup.waitFor({ state: 'visible' });

    expect(await popup.evaluate((element) => element.closest('main') === null)).toBe(true);
    expect(await page.getByTestId('font-trigger').getAttribute('aria-expanded')).toBe('true');

    await page.getByRole('option', { name: 'Monospace' }).click();
    // The focus of the trigger keeps the items mounted, so the closed popup stays in the body.
    await popup.waitFor({ state: 'hidden' });

    expect(await page.getByTestId('font-value').textContent()).toBe('Monospace');
    expect(await readFormData(page)).toEqual(['font=mono', 'size=', 'tags=b']);
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

  it('blocks the submit of /field while the required control is empty and sends it after hydration', async () => {
    const page = await createPage('/field');
    const messages = collectMessages(page);
    const control = page.getByTestId('required-control');
    const error = page.getByTestId('required-error');
    const readFocusedTestId = () =>
      page.evaluate(() => document.activeElement?.getAttribute('data-testid'));

    await page.getByTestId('submit').click();
    await error.waitFor();

    expect(await page.getByTestId('output').textContent()).toBe('');
    expect(await control.getAttribute('aria-invalid')).toBe('true');
    expect(await control.getAttribute('aria-describedby')).toBe(await error.getAttribute('id'));
    expect(await readFocusedTestId()).toBe('required-control');

    await control.fill('a@b.c');
    await page.getByTestId('submit').click();

    expect(await page.getByTestId('output').textContent()).toBe('a@b.c');
    expect(await error.count()).toBe(0);
    expect(page.url()).toBe(url('/field'));
    expect(messages).toEqual([]);
  });

  it('types a code into /otp-field, and focuses the first slot on a click on a native label, after hydration', async () => {
    const page = await createPage('/otp-field');
    const messages = collectMessages(page);
    const readFocusedTestId = () =>
      page.evaluate(() => document.activeElement?.getAttribute('data-testid'));

    await page.getByTestId('code-3').click();
    await page.keyboard.type('34');

    expect(await readOTPSlotValues(page, 'code')).toEqual(['1', '2', '3', '4']);
    expect(await page.getByTestId('code-value').textContent()).toBe('1234');
    expect(await readFormData(page)).toEqual(['code=1234']);
    expect(await page.getByTestId('code').getAttribute('data-complete')).toBe('');
    expect(await readFocusedTestId()).toBe('code-4');

    await page.getByTestId('pin-label').click();

    expect(await readFocusedTestId()).toBe('pin-1');
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

  it('positions the indicator of /tabs with its inline script when the files of the app do not load', async () => {
    const page = await createPage();
    await page.route('**/_nuxt/**', (route) => route.abort());

    await page.goto(url('/tabs'));

    // Vue removes the script when it hydrates, so the script shows that nothing hydrated.
    expect(await page.locator('[role="tablist"] script').count()).toBe(1);
    await expectIndicatorUnderTab(page, 'tab-b', { left: '100px', right: '100px' });
  });

  it('selects a tab of /tabs on a click and moves the indicator after hydration', async () => {
    const page = await createPage('/tabs');
    const messages = collectMessages(page);
    const readTab = (testId: string) =>
      readAttributes(page.getByTestId(testId), ['aria-selected', 'tabindex']);

    await page.getByTestId('tab-c').click();

    expect(await readTab('tab-c')).toEqual({ 'aria-selected': 'true', tabindex: '0' });
    expect(await readTab('tab-b')).toEqual({ 'aria-selected': 'false', tabindex: '-1' });
    expect(await page.getByTestId('panel-c').getAttribute('hidden')).toBeNull();
    await expectIndicatorUnderTab(page, 'tab-c', { left: '200px', right: '0px' });
    expect(messages).toEqual([]);
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

  it('formats the text of /number-field with the locale of the visitor after hydration', async () => {
    const page = await createPage(undefined, { locale: 'de-DE' });
    const messages = collectMessages(page);

    await page.goto(url('/number-field'), { waitUntil: 'hydration' });
    await waitForTwoFrames(page);

    const visitorText = await page.evaluate(
      (format) => new Intl.NumberFormat(undefined, format).format(1234.5),
      EURO_FORMAT,
    );
    expect(visitorText).not.toBe(EURO_TEXT);
    expect(await page.getByTestId('label-first-control').inputValue()).toBe(visitorText);
    expect(await page.getByTestId('label-last-control').inputValue()).toBe('7');
    expect(await readFormData(page)).toEqual(['amount=1234.5', 'quantity=7']);
    expect(messages).toEqual([]);
  });

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
