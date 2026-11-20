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
const PROVIDER_TEXT = new Intl.NumberFormat('fr-FR', { style: 'percent' }).format(0.42);
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

async function expectButtonPage(page: Page, { hydrated = false } = {}) {
  const attributeNames = ['type', 'tabindex', 'disabled', 'aria-disabled', 'data-disabled', 'role'];
  const read = (testId: string) => readAttributes(page.getByTestId(testId), attributeNames);
  const none = Object.fromEntries(attributeNames.map((name) => [name, null]));

  expect(await page.getByTestId('counter').textContent()).toBe('Count 0');
  const button = { ...none, type: 'button' };
  expect(await read('counter')).toEqual(button);
  expect(await read('disabled')).toEqual({ ...button, disabled: '' });
  expect(await read('focusable')).toEqual({ ...button, 'aria-disabled': 'true' });
  // The part knows the element of its `element` slot after the mount. Until then, it writes the
  // attributes of a native button.
  expect(await read('span')).toEqual(
    hydrated ? { ...none, tabindex: '0', role: 'button' } : button,
  );
}

async function expectSeparatorPage(page: Page) {
  const attributeNames = ['role', 'aria-orientation', 'data-orientation', 'class'];

  expect(await readAttributes(page.getByTestId('separator'), attributeNames)).toEqual({
    role: 'separator',
    'aria-orientation': 'vertical',
    'data-orientation': null,
    class: 'divider',
  });
}

async function expectAsPage(page: Page) {
  const read = (testId: string) => readElement(page.getByTestId(testId), ['role', 'href', 'type']);

  expect(await read('separator')).toEqual({
    tag: 'span',
    text: '',
    attributes: { role: 'separator', href: null, type: null },
  });
  for (const [testId, text] of [
    ['nuxt-tab', 'A'],
    ['router-tab', 'B'],
  ]) {
    expect((await read(testId!)).tag).toBe('a');
    expect(await read(testId!)).toMatchObject({ text, attributes: { role: 'tab', href: '/as' } });
  }
  expect(await read('div-tab')).toEqual({
    tag: 'div',
    text: 'C',
    attributes: { role: 'tab', href: null, type: null },
  });
}

// A part reads the element of a component in `as` after the mount: the root element of
// `NuxtLink` and of `RouterLink`, which expose nothing.
async function expectHydratedAsPage(page: Page) {
  await expectAsPage(page);
  expect(await page.getByTestId('tab-elements').textContent()).toBe('a a');
  expect(await page.getByTestId('link-ref').textContent()).toBe('$el: a, element: false');
  expect(await page.getByTestId('nuxt-tab').getAttribute('type')).toBeNull();
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

// A root in a `LocaleProvider` has the locale of the provider.
async function expectProviderRoot(page: Page) {
  expect(await page.getByTestId('provider-value').textContent()).toBe(PROVIDER_TEXT);
  expect(await page.getByTestId('provider-root').getAttribute('aria-valuetext')).toBe(
    PROVIDER_TEXT,
  );
}

async function expectRangePage(page: Page, rootAttributes: RangeRootAttributes) {
  await expectCurrencyRoot(page, rootAttributes);
  await expectProviderRoot(page);
  expect(await page.getByTestId('percent-value').textContent()).toBe(PERCENT_TEXT);
  expect(await page.getByTestId('percent-root').getAttribute('aria-labelledby')).toBeNull();
}

// The root names the fieldset with the id of its legend.
async function expectFieldsetPage(page: Page) {
  const readTag = (testId: string) =>
    page.getByTestId(testId).evaluate((element) => element.localName);

  expect(await readTag('fieldset')).toBe('fieldset');
  expect(await readTag('legend')).toBe('div');
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

// A trigger before its panel names the panel after the hydration.
async function expectCollapsiblePage(page: Page, { hydrated = false } = {}) {
  const readTrigger = (testId: string) =>
    readAttributes(page.getByTestId(testId), ['aria-expanded', 'aria-controls']);
  const readPanel = (testId: string) =>
    readAttributes(page.getByTestId(testId), ['hidden', 'inert']);
  // The trigger names the panel only while the panel is open.
  const closedTrigger = { 'aria-expanded': 'false', 'aria-controls': null };

  expect(await readTrigger('closed-trigger')).toEqual(closedTrigger);
  expect(await page.getByTestId('closed-panel').count()).toBe(0);

  const openPanelId = await page.getByTestId('open-panel').getAttribute('id');
  expect(openPanelId).toBeTruthy();
  expect(await readTrigger('open-trigger')).toEqual({
    'aria-expanded': 'true',
    'aria-controls': hydrated ? openPanelId : null,
  });
  expect(await readPanel('open-panel')).toEqual({ hidden: null, inert: null });

  const untilFoundPanel = page.getByTestId('until-found-panel');
  expect(await readTrigger('until-found-trigger')).toEqual(closedTrigger);
  expect(await readPanel('until-found-panel')).toEqual({ hidden: 'until-found', inert: null });
  expect((await untilFoundPanel.textContent())?.trim()).toBe('Until found panel');

  const untilFoundPanelId = await untilFoundPanel.getAttribute('id');
  expect(untilFoundPanelId).toBeTruthy();
  expect(untilFoundPanelId).not.toBe(openPanelId);
}

// A trigger before its panel names the panel after the hydration. A panel after its trigger names
// the trigger in the server HTML.
async function expectAccordionPage(page: Page, { hydrated = false } = {}) {
  const readTrigger = (testId: string) =>
    readAttributes(page.getByTestId(testId), ['aria-expanded', 'aria-controls']);
  const readPanel = (testId: string) =>
    readAttributes(page.getByTestId(testId), ['hidden', 'inert', 'role']);
  const readIds = async (name: string) => ({
    triggerId: await page.getByTestId(`${name}-trigger`).getAttribute('id'),
    labelledBy: await page.getByTestId(`${name}-panel`).getAttribute('aria-labelledby'),
    panelId: await page.getByTestId(`${name}-panel`).getAttribute('id'),
  });

  // The trigger names the panel only while the panel is open.
  expect(await readTrigger('closed-trigger')).toEqual({
    'aria-expanded': 'false',
    'aria-controls': null,
  });
  expect(await page.getByTestId('closed-panel').count()).toBe(0);

  const open = await readIds('open');
  expect(open.triggerId).toBeTruthy();
  expect(open.panelId).toBeTruthy();
  expect(open.labelledBy).toBe(open.triggerId);
  expect(await readTrigger('open-trigger')).toEqual({
    'aria-expanded': 'true',
    'aria-controls': hydrated ? open.panelId : null,
  });
  expect(await readPanel('open-panel')).toEqual({ hidden: null, inert: null, role: 'region' });
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
  });
  expect(await readPanel('until-found-panel')).toEqual({
    hidden: 'until-found',
    inert: null,
    role: 'region',
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

// A toolbar writes its tab stop after the mount of its items, so each button of the server HTML is
// in the order of the Tab key.
async function expectToolbarPage(page: Page) {
  for (const toolbar of TOOLBARS) {
    expect(await readToolbarTabindexes(page, toolbar.toolbar)).toEqual([null, null, null]);
  }
  expect(await page.getByTestId('disabled-first-1').getAttribute('disabled')).toBe('');
}

// After the mount, the tab stop is the first button that can get focus. A server runs the `setup`
// of the first button of the toolbar `async` after the `setup` of the buttons that follow it.
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

// A group and a toolbar write their tab stop at the mount, so each button of the server HTML is in
// the order of the Tab key. In a toolbar, the toggles are items of the toolbar.
async function expectToggleGroupPage(page: Page) {
  expect(await page.getByTestId('alone').getAttribute('role')).toBe('group');
  expect(await readButtons(page, 'alone', 'tabindex')).toEqual([null, null, null]);
  expect(await readButtons(page, 'alone', 'aria-pressed')).toEqual(['false', 'true', 'false']);
  expect(await readButtons(page, 'disabled-first', 'tabindex')).toEqual([null, null]);
  expect(await readButtons(page, 'in-toolbar', 'tabindex')).toEqual([null, null, null]);
  expect(await readButtons(page, 'in-toolbar', 'aria-pressed')).toEqual([null, 'true', 'false']);
  expect(await readAttributes(page.getByTestId('single'), ['tabindex', 'aria-pressed'])).toEqual({
    tabindex: null,
    'aria-pressed': 'true',
  });
}

// The tab stop of a group is its first toggle that is not disabled, also when another toggle is
// pressed. The tab stop of a toolbar is its first item.
async function expectHydratedToggleGroupPage(page: Page) {
  expect(await readButtons(page, 'alone', 'tabindex')).toEqual(['0', '-1', '-1']);
  expect(await readButtons(page, 'disabled-first', 'tabindex')).toEqual(['-1', '0']);
  expect(await readButtons(page, 'in-toolbar', 'tabindex')).toEqual(['0', '-1', '-1']);
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

  expect(controlId).toBeTruthy();
  expect(await page.getByTestId(`${name}-label`).getAttribute('for')).toBe(controlId);
  expect(
    await readAttributes(page.getByTestId(`${name}-control`), [
      'aria-labelledby',
      'aria-describedby',
    ]),
  ).toEqual({
    'aria-labelledby': null,
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
  ).toEqual({ 'data-invalid': null, 'aria-invalid': 'true' });
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

// Panel `a` is not mounted, so no tab names it. The server HTML names only the part that comes
// before: the panels after the list name their tabs, and a tab after its panel names the panel.
async function expectTabIds(page: Page, hydrated: boolean) {
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
// in it has the nonce of the provider. It does not run here, because this page has no JavaScript.
async function expectTabsPage(page: Page) {
  await expectTabIds(page, false);

  expect(
    await page.locator('[role="tablist"] script').evaluateAll((scripts) =>
      scripts.map((script) => ({
        nonce: script.getAttribute('nonce'),
        parent: script.parentElement?.getAttribute('data-testid'),
        hasText: script.textContent?.includes('currentScript'),
      })),
    ),
  ).toEqual([{ nonce: 'test-nonce', parent: 'indicator', hasText: true }]);
  expect(await readAttributes(page.getByTestId('indicator'), ['hidden', 'role'])).toEqual({
    hidden: '',
    role: 'presentation',
  });
  expect(await readActiveTabVariables(page)).toEqual(
    Object.fromEntries(ACTIVE_TAB_VARIABLE_SUFFIXES.map((suffix) => [suffix, ''])),
  );
}

async function expectHydratedTabsPage(page: Page) {
  await expectTabIds(page, true);

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
  ).toEqual({ 'data-invalid': null, 'aria-invalid': 'true' });
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
    readAttributes(page.getByTestId(testId), ['type', 'role', 'checked', 'aria-label']);

  return {
    notifications: await read('notifications'),
    wifi: await read('wifi'),
    formData: await readFormData(page),
  };
}

// The `formdata` listener that gives the entry of `uncheckedValue` runs after the hydration.
async function expectSwitchPage(page: Page) {
  expect(await readSwitchPage(page)).toEqual({
    notifications: { type: 'checkbox', role: 'switch', checked: null, 'aria-label': null },
    wifi: { type: 'checkbox', role: 'switch', checked: '', 'aria-label': 'Wi-Fi' },
    formData: ['wifi=on'],
  });
}

async function expectHydratedSwitchPage(page: Page) {
  expect((await readSwitchPage(page)).formData).toEqual(['wifi=on', 'notifications=no']);
}

async function readCheckboxPage(page: Page) {
  const read = (testId: string) =>
    readAttributes(page.getByTestId(testId), [
      'type',
      'checked',
      'data-indeterminate',
      'aria-label',
    ]);

  return {
    terms: await read('terms'),
    news: await read('news'),
    some: await read('some'),
    formData: await readFormData(page),
    indeterminate: await page
      .getByTestId('form')
      .evaluate((element) =>
        Array.from(
          element.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
          (input) => input.indeterminate,
        ),
      ),
  };
}

// The `formdata` listener that gives the entry of `uncheckedValue` runs after the hydration.
async function expectCheckboxPage(page: Page) {
  expect(await readCheckboxPage(page)).toEqual({
    terms: { type: 'checkbox', checked: null, 'data-indeterminate': null, 'aria-label': null },
    news: { type: 'checkbox', checked: '', 'data-indeterminate': null, 'aria-label': 'News' },
    some: { type: 'checkbox', checked: null, 'data-indeterminate': '', 'aria-label': 'Some' },
    formData: ['news=on'],
    // HTML has no attribute for `indeterminate`, so a server cannot write it.
    indeterminate: [false, false, false],
  });
}

async function expectHydratedCheckboxPage(page: Page) {
  const { formData, indeterminate } = await readCheckboxPage(page);
  expect(formData).toEqual(['news=on', 'terms=no']);
  expect(indeterminate).toEqual([false, false, true]);
}

function readRadios(page: Page, testId: string, attributeName: string) {
  return page
    .getByTestId(testId)
    .locator('input[type="radio"]')
    .evaluateAll((radios, name) => radios.map((radio) => radio.getAttribute(name)), attributeName);
}

function readCheckedRadios(page: Page, testId: string) {
  return page
    .getByTestId(testId)
    .locator('input[type="radio"]')
    .evaluateAll((radios) => radios.map((radio) => (radio as HTMLInputElement).checked));
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

// The label comes after the group, and the server HTML names the group with it. The server HTML
// has no `tabindex`: the browser gives the tab stop to the checked radio of a named group. After
// the mount, the tab stop has no `tabindex`, and each other radio has `-1`.
async function expectRadioGroupPage(page: Page, { hydrated }: { hydrated: boolean }) {
  const labelId = await page.getByTestId('label').getAttribute('id');
  expect(labelId).toBeTruthy();
  expect(await readAttributes(page.getByTestId('fruit'), ['role', 'aria-labelledby'])).toEqual({
    role: 'radiogroup',
    'aria-labelledby': labelId,
  });
  const tabStops = hydrated ? ['-1', null, '-1'] : [null, null, null];
  expect(await readCheckedRadios(page, 'fruit')).toEqual([false, true, false]);
  expect(await readRadios(page, 'fruit', 'tabindex')).toEqual(tabStops);
  expect(await readFormData(page)).toEqual(['fruit=banana']);
  expect(await readCheckedRadios(page, 'empty')).toEqual([false, false, false]);
  expect(await readRadios(page, 'empty', 'tabindex')).toEqual(tabStops);
}

const APPLE_TEST_IDS = ['fuji', 'gala', 'granny-smith'];

async function readCheckboxGroupPage(page: Page) {
  const readState = (testId: string) =>
    page.getByTestId(testId).evaluate((element) => {
      const input = element as HTMLInputElement;
      return input.indeterminate ? 'mixed' : String(input.checked);
    });

  return {
    group: await readAttributes(page.getByTestId('group'), ['role', 'aria-labelledby']),
    parent: await readAttributes(page.getByTestId('parent'), [
      'name',
      'data-indeterminate',
      'aria-controls',
    ]),
    parentState: await readState('parent'),
    apples: await Promise.all(APPLE_TEST_IDS.map(readState)),
    formData: await readFormData(page),
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
      name: null,
      'data-indeterminate': '',
      'aria-controls': hydrated ? childIds.join(' ') : null,
    },
    parentState: hydrated ? 'mixed' : 'false',
    apples: ['true', 'false', 'false'],
    formData: ['apples=fuji'],
  });
}

function readOTPSlots(page: Page, testId: string, attributeName: string) {
  return page
    .getByTestId(testId)
    .locator('input:not([aria-hidden])')
    .evaluateAll((inputs, name) => inputs.map((input) => input.getAttribute(name)), attributeName);
}

function readOTPSlotValues(page: Page, testId: string) {
  return page
    .getByTestId(testId)
    .locator('input:not([aria-hidden])')
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

function readDateFieldSegments(page: Page, testId: string, attributeName: string) {
  return page
    .getByTestId(testId)
    .locator('input[data-type]')
    .evaluateAll((inputs, name) => inputs.map((input) => input.getAttribute(name)), attributeName);
}

function readDateFieldValues(page: Page, testId: string) {
  return page
    .getByTestId(testId)
    .locator('input[data-type]')
    .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
}

// The label of the first field comes after the field, and the server HTML names the group with it.
// The hidden input has the name and the ISO text of the value.
async function expectDateFieldPage(page: Page) {
  const labelId = await page.getByTestId('when-label').getAttribute('id');
  expect(labelId).toBeTruthy();
  expect(await page.getByTestId('when').getAttribute('aria-labelledby')).toBe(labelId);
  expect(await page.getByTestId('when').getAttribute('role')).toBe('group');
  expect(await readDateFieldSegments(page, 'when', 'data-type')).toEqual(['month', 'day', 'year']);
  expect(await readDateFieldValues(page, 'when')).toEqual(['11', '14', '2026']);
  expect(await page.getByTestId('when-value').textContent()).toBe('2026-11-14');
  expect(await readFormData(page)).toEqual(['when=2026-11-14']);
  expect(await readDateFieldValues(page, 'card')).toEqual(['11', '2026']);
}

// The first calendar shows days and the second is a month picker. Each shows its grid in the server
// HTML, with one tab stop on its selected day or month.
async function expectCalendarPage(page: Page) {
  const days = page.getByTestId('days');
  expect(await days.getAttribute('role')).toBe('group');
  expect(await days.getAttribute('aria-label')).toBe('November 2026');
  expect(await days.getAttribute('data-view')).toBe('day');
  expect(await days.locator('[data-date] button[tabindex="0"]').evaluateAll(readDates)).toEqual([
    '2026-11-10',
  ]);
  expect(await page.getByTestId('day-value').textContent()).toBe('2026-11-10');

  const months = page.getByTestId('months');
  expect(await months.getAttribute('data-view')).toBe('month');
  expect(await months.locator('[role="gridcell"]').count()).toBe(12);
  expect(await readTabStops(months)).toEqual(['March 2026']);
  expect(await readSelected(months)).toEqual(['March 2026']);
  expect(await page.getByTestId('month-value').textContent()).toBe('2026-03');
}

// The text that the runtime of the caller gives for the page `date-layout`. The function runs in
// Node for the server HTML and in the page for the hydrated page, so it reads nothing outside
// its body.
function dateLayoutText() {
  const locale = 'is-IS';
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { timeZone: 'UTC', calendar: 'gregory', ...options });
  const twoDigits = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false });
  const fieldNames = new Intl.DisplayNames(locale, { type: 'dateTimeField' });
  const hour12 = format({ hour: 'numeric' }).resolvedOptions().hour12;
  const selectedDay = Date.UTC(2026, 10, 10);
  return {
    hour12,
    hourText: twoDigits.format(hour12 ? 1 : 13),
    minuteText: twoDigits.format(45),
    hourName: fieldNames.of('hour'),
    minuteName: fieldNames.of('minute'),
    monthName: format({ month: 'long', year: 'numeric' }).format(selectedDay),
    dayName: format({ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(
      selectedDay,
    ),
    // The week of `is-IS` starts on Sunday, and 2026-11-01 is a Sunday.
    weekdays: Array.from({ length: 7 }, (_, index) => ({
      text: format({ weekday: 'short' }).format(Date.UTC(2026, 10, index + 1)),
      abbr: format({ weekday: 'long' }).format(Date.UTC(2026, 10, index + 1)),
    })),
  };
}

// Node has `Intl` data for `is-IS`, and Chromium has none and uses `en-US`. The server HTML thus
// has a clock of 24 hours and Icelandic names. The hydrated page has a clock of 12 hours and
// English names. The grid of the calendar has the same days in the two. Vue writes the text of the
// browser in a part that allows a text mismatch, and keeps the attributes of the server.
async function expectDateLayoutPage(page: Page, { hydrated }: { hydrated: boolean }) {
  const text = hydrated ? await page.evaluate(dateLayoutText) : dateLayoutText();
  // With the same hour cycle in Node and in Chromium, the page tests nothing.
  expect(text.hour12).toBe(hydrated);

  const clock = page.getByTestId('clock');
  expect(await readAttributes(clock.getByRole('slider'), ['min', 'max', 'aria-label'])).toEqual({
    min: hydrated ? '1' : '0',
    max: hydrated ? '12' : '23',
    'aria-label': text.hourName,
  });
  expect(await clock.getByRole('slider').inputValue()).toBe(hydrated ? '1' : '13');
  expect(await clock.getByTestId('number').count()).toBe(hydrated ? 12 : 24);
  expect(await clock.locator('[data-testid="number"][data-inner]').count()).toBe(hydrated ? 0 : 12);
  expect(await clock.getByTestId('period').count()).toBe(hydrated ? 2 : 0);
  expect(await page.getByTestId('hour').textContent()).toBe(text.hourText);
  expect(await page.getByTestId('hour').getAttribute('aria-label')).toBe(
    `${text.hourName} ${text.hourText}`,
  );
  expect(await page.getByTestId('minute').textContent()).toBe(text.minuteText);
  expect(await page.getByTestId('minute').getAttribute('aria-label')).toBe(
    `${text.minuteName} ${text.minuteText}`,
  );
  expect(await page.getByTestId('time-value').textContent()).toBe('13:45:00');

  const serverText = dateLayoutText();
  const calendar = page.getByTestId('calendar');
  const captionId = await page.getByTestId('caption').getAttribute('id');
  expect(captionId).toBeTruthy();
  expect(await calendar.getAttribute('aria-label')).toBe(serverText.monthName);
  expect(await page.getByTestId('caption').textContent()).toBe(text.monthName);
  expect(await calendar.getByRole('grid').getAttribute('aria-labelledby')).toBe(captionId);
  expect(
    await calendar
      .getByRole('columnheader')
      .evaluateAll((headers) =>
        headers.map((header) => ({ text: header.textContent, abbr: header.getAttribute('abbr') })),
      ),
  ).toEqual(
    text.weekdays.map((weekday, index) => ({ ...weekday, abbr: serverText.weekdays[index]!.abbr })),
  );
  const dates = Array.from({ length: 35 }, (_, index) =>
    Temporal.PlainDate.from('2026-11-01').add({ days: index }).toString(),
  );
  expect(
    await calendar
      .locator('td[data-date]')
      .evaluateAll((cells) => cells.map((cell) => cell.getAttribute('data-date'))),
  ).toEqual(dates);
  expect(
    await calendar
      .locator('td[data-weekend]')
      .evaluateAll((cells) => cells.map((cell) => cell.getAttribute('data-date'))),
  ).toEqual(dates.filter((date) => Temporal.PlainDate.from(date).dayOfWeek >= 6));
  expect(await calendar.locator('[data-date="2026-11-10"] button').getAttribute('aria-label')).toBe(
    serverText.dayName,
  );
  expect(await calendar.locator('button[tabindex="0"]').evaluateAll(readDates)).toEqual([
    '2026-11-10',
  ]);
  expect(await page.getByTestId('date-value').textContent()).toBe('2026-11-10');
}

function readDates(buttons: Element[]) {
  return buttons.map((button) => button.closest('[data-date]')!.getAttribute('data-date'));
}

function readTabStops(calendar: Locator) {
  return calendar
    .locator('[role="gridcell"][tabindex="0"]')
    .evaluateAll((cells) => cells.map((cell) => cell.getAttribute('aria-label')));
}

function readSelected(calendar: Locator) {
  return calendar
    .locator('[role="gridcell"][aria-selected="true"]')
    .evaluateAll((cells) => cells.map((cell) => cell.getAttribute('aria-label')));
}

// The server HTML has the field with the value, the hidden input and the trigger with its name. It
// has no popup, because the portal renders after the mount.
async function expectDatePickerPage(page: Page) {
  expect(await page.getByTestId('when').getAttribute('role')).toBe('group');
  expect(await readDateFieldValues(page, 'when')).toEqual(['11', '10', '2026']);
  expect(await page.getByTestId('when-value').textContent()).toBe('2026-11-10');
  expect(await readFormData(page)).toEqual(['when=2026-11-10']);
  const trigger = page.getByTestId('when-trigger');
  expect(await trigger.getAttribute('aria-haspopup')).toBe('dialog');
  expect(await trigger.getAttribute('aria-expanded')).toBe('false');
  expect(await trigger.getAttribute('aria-label')).toBe('Change date, Tuesday, November 10, 2026');
  expect(await page.getByTestId('when-popup').count()).toBe(0);
}

// The name of the trigger has a range with spaces that depend on the data of `Intl`.
function readTriggerName(page: Page) {
  return page
    .getByTestId('when-trigger')
    .getAttribute('aria-label')
    .then((name) => name?.replace(/\s+/g, ' '));
}

// The server HTML has the two fields with the range, the two hidden inputs and the trigger with its
// name. It has no popup, because the portal renders after the mount.
async function expectDateRangePickerPage(page: Page) {
  expect(await page.getByTestId('from').getAttribute('role')).toBe('group');
  expect(await page.getByTestId('to').getAttribute('role')).toBe('group');
  expect(await readDateFieldValues(page, 'from')).toEqual(['11', '10', '2026']);
  expect(await readDateFieldValues(page, 'to')).toEqual(['11', '12', '2026']);
  expect(await page.getByTestId('when-value').textContent()).toBe('2026-11-10 2026-11-12');
  expect(await readFormData(page)).toEqual(['from=2026-11-10', 'to=2026-11-12']);
  const trigger = page.getByTestId('when-trigger');
  expect(await trigger.getAttribute('aria-haspopup')).toBe('dialog');
  expect(await trigger.getAttribute('aria-expanded')).toBe('false');
  expect(await readTriggerName(page)).toBe(
    'Change dates, Tuesday, November 10 – Thursday, November 12, 2026',
  );
  expect(await page.getByTestId('when-popup').count()).toBe(0);
}

// The text that a time picker gives to the name of its trigger, as `Intl` makes it in Node.js.
function formatTime(hour: number) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h12',
    timeZone: 'UTC',
  }).format(Date.UTC(1970, 0, 1, hour));
}

// The server HTML has the field with the value, the hidden input and the trigger with its name. It
// has no popup, because the portal renders after the mount.
async function expectTimePickerPage(page: Page) {
  expect(await page.getByTestId('start').getAttribute('role')).toBe('group');
  expect(await readDateFieldValues(page, 'start')).toEqual(['3', '00', 'PM']);
  expect(await page.getByTestId('start-value').textContent()).toBe('15:00:00');
  expect(await readFormData(page)).toEqual(['start=15:00']);
  const trigger = page.getByTestId('start-trigger');
  expect(await trigger.getAttribute('aria-haspopup')).toBe('dialog');
  expect(await trigger.getAttribute('aria-expanded')).toBe('false');
  expect(await trigger.getAttribute('aria-label')).toBe(`Change time, ${formatTime(15)}`);
  expect(await page.getByTestId('start-popup').count()).toBe(0);
}

// The server HTML has no name from a native label. After the mount, the root names its group with
// the label of its first segment, and gives that label an id.
async function expectDateFieldPageWithNativeLabel(page: Page, { hydrated }: { hydrated: boolean }) {
  await expectDateFieldPage(page);
  expect(await page.getByTestId('card').getAttribute('aria-labelledby')).toBe(
    hydrated ? 'card-label' : null,
  );
}

// A native label outside a field names the element that its `for` names: the first slot. The
// `aria-labelledby` of the developer names the group with it.
async function expectOTPFieldPageWithNativeLabel(page: Page) {
  await expectOTPFieldPage(page);
  expect(await page.getByTestId('pin').getAttribute('aria-labelledby')).toBe('pin-label');
  expect(await page.getByTestId('pin-label').getAttribute('for')).toBe(
    await page.getByTestId('pin-1').getAttribute('id'),
  );
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

async function readSliderPage(page: Page) {
  return page.evaluate(() => {
    const all = (testId: string) =>
      Array.from(document.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`));
    const input = (thumb: HTMLElement) => thumb.querySelector('input')!;
    const read = (element: Element, names: string[]) =>
      Object.fromEntries(names.map((name) => [name, element.getAttribute(name)]));
    const [volumeThumb] = all('volume-thumb');
    const control = all('price-control')[0].getBoundingClientRect();

    return {
      volumeRoot: read(all('volume')[0], ['role', 'aria-labelledby']),
      volumeLabel: read(all('volume-label')[0], ['id', 'for']),
      volumeInput: read(input(volumeThumb), ['id', 'aria-labelledby', 'value', 'name']),
      volumeValue: [all('volume-value')[0].textContent, all('volume-value')[0].getAttribute('for')],
      priceRoot: read(all('price')[0], ['aria-labelledby']),
      priceLabelId: all('price-label')[0].id,
      priceInputs: all('price-thumb').map((thumb) =>
        read(input(thumb), ['aria-label', 'aria-labelledby']),
      ),
      // The left and the right end of each edge thumb in its control, in pixels.
      priceThumbs: all('price-thumb').map((thumb) => {
        const rect = thumb.getBoundingClientRect();
        return [rect.left - control.left, rect.right - control.left];
      }),
      scripts: document.querySelectorAll('[data-testid="form"] script').length,
      // The entries that a submit of the page sends.
      formData: Array.from(
        new FormData(document.querySelector('form')!),
        ([name, value]) => `${name}=${String(value)}`,
      ),
    };
  });
}

// A thumb of 40 px in a control of 200 px, at 25 and 75.
const EDGE_THUMBS = [
  [40, 80],
  [120, 160],
];

async function expectSliderPage(page: Page) {
  const result = await readSliderPage(page);

  // CSS places an edge thumb in the control, with no script.
  expect(result.scripts).toBe(0);
  expect(result.priceThumbs).toEqual(EDGE_THUMBS);
  // The label names the input of the first thumb, and an input after the label.
  expect(result.volumeLabel.for).toBe(result.volumeInput.id);
  expect(result.volumeInput['aria-labelledby']).toBe(result.volumeLabel.id);
  // The root, and the output before the thumbs, name their parts after the mount.
  expect(result.volumeRoot).toEqual({ role: 'group', 'aria-labelledby': null });
  expect(result.priceRoot['aria-labelledby']).toBeNull();
  expect(result.volumeValue).toEqual(['30', null]);
  // A thumb that has a name of its own does not use the label.
  expect(result.priceInputs.map((input) => input['aria-labelledby'])).toEqual([null, null]);
  expect(result.formData).toEqual(['volume=30', 'price=25', 'price=75']);
}

async function expectHydratedSliderPage(page: Page) {
  const result = await readSliderPage(page);

  expect(result.priceThumbs).toEqual(EDGE_THUMBS);
  expect(result.volumeRoot['aria-labelledby']).toBe(result.volumeLabel.id);
  expect(result.priceRoot['aria-labelledby']).toBe(result.priceLabelId);
  expect(result.volumeValue).toEqual(['30', result.volumeInput.id]);
  expect(result.formData).toEqual(['volume=30', 'price=25', 'price=75']);
}

// The portal renders after the mount, so the server HTML has no portal element.
async function expectPortalPageOnServer(page: Page) {
  expect(await page.getByTestId('trigger').count()).toBe(1);
  expect(await page.locator('[data-vase-ui-portal]').count()).toBe(0);
}

// Each portal uses its target after mount. An explicit null delays the portal.
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

const TOAST_VIEWPORT_ATTRIBUTES = [
  'role',
  'tabindex',
  'aria-live',
  'aria-atomic',
  'aria-relevant',
  'aria-label',
];

async function expectToastViewport(page: Page) {
  expect(await readAttributes(page.getByTestId('viewport'), TOAST_VIEWPORT_ATTRIBUTES)).toEqual({
    role: 'region',
    tabindex: '-1',
    'aria-live': 'polite',
    'aria-atomic': 'false',
    'aria-relevant': 'additions text',
    'aria-label': 'Notifications',
  });
  expect(await page.getByTestId('toast').count()).toBe(0);
}

// The viewport in the page is in the server HTML. A portal renders after the mount, so the server
// HTML has no element of the viewport in `Toast.Portal`.
async function expectToastPageOnServer(page: Page) {
  await expectToastViewport(page);
  expect(await page.getByTestId('anchored-viewport').count()).toBe(0);
}

async function expectHydratedToastPage(page: Page) {
  await expectToastViewport(page);
  expect(
    await page
      .getByTestId('anchored-viewport')
      .evaluate((element) => element.parentElement?.hasAttribute('data-vase-ui-portal')),
  ).toBe(true);
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

// A closed menu has the links of a kept content in its server HTML, and no links of another
// content. An open item has no content before the mount, because its viewport has no target then.
async function expectNavigationMenuPage(page: Page, { hydrated }: { hydrated: boolean }) {
  const linkAttributes = ['href', 'aria-current'];
  const countLinksInItem = (testId: string) =>
    page.getByTestId(testId).locator('xpath=ancestor::li[1]//a').count();

  expect(await page.getByTestId('kept-link').count()).toBe(1);
  expect(await page.getByTestId('kept-content').getAttribute('hidden')).toBe('');
  expect(await page.getByTestId('unkept-link').count()).toBe(0);
  // The `<a>` of the current route has `aria-current="page"`.
  expect(await readElement(page.getByTestId('nuxt-link'), linkAttributes)).toEqual({
    tag: 'a',
    text: 'Menu',
    attributes: { href: '/navigation-menu', 'aria-current': 'page' },
  });
  expect(await readElement(page.getByTestId('router-link'), linkAttributes)).toEqual({
    tag: 'a',
    text: 'Home',
    attributes: { href: '/', 'aria-current': null },
  });
  expect(await countLinksInItem('nuxt-link')).toBe(1);
  expect(await countLinksInItem('router-link')).toBe(1);
  expect(await page.getByTestId('news-trigger').getAttribute('aria-expanded')).toBe('true');
  if (hydrated) {
    await page.getByTestId('news-content').waitFor({ state: 'attached', timeout: 5000 });
    expect(await page.getByTestId('news-content').getAttribute('hidden')).toBe(null);
  } else {
    expect(await page.getByTestId('news-content').count()).toBe(0);
  }
}

// A server renders no popup and no portal. The trigger of an open root has the open state. The
// trigger of a handle has the closed form, because a server attaches no store to a handle.
async function expectMenuPageOnServer(page: Page) {
  const attributeNames = ['aria-haspopup', 'aria-expanded', 'data-pressed'];
  const read = (testId: string) => readAttributes(page.getByTestId(testId), attributeNames);
  const closed = { 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'data-pressed': null };

  expect(await read('closed')).toEqual(closed);
  expect(await read('open')).toEqual({ ...closed, 'aria-expanded': 'true' });
  expect(await read('detached')).toEqual(closed);
  expect(await page.locator('[role="menu"]').count()).toBe(0);
}

// After the mount, the open root renders its popup in `<body>`, and the trigger of the handle
// follows its root.
async function expectHydratedMenuPage(page: Page) {
  const popup = page.getByTestId('open-popup');
  expect(await popup.count()).toBe(1);
  expect(await popup.evaluate((element) => element.parentElement?.parentElement?.localName)).toBe(
    'body',
  );
  expect(await popup.getAttribute('role')).toBe('menu');
  expect(await popup.getAttribute('aria-labelledby')).toBe('open-trigger');
  expect(await page.getByTestId('open').getAttribute('aria-controls')).toBe(
    await popup.getAttribute('id'),
  );
  expect(await popup.textContent()).toBe('Open popup');

  expect(await page.getByTestId('closed').getAttribute('aria-expanded')).toBe('false');
  expect(await page.getByTestId('detached').getAttribute('aria-expanded')).toBe('false');
  expect(await page.getByTestId('closed-popup').count()).toBe(0);
  expect(await page.getByTestId('detached-popup').count()).toBe(0);
}

// A server renders the bar with its native buttons: the bar gives its one tab stop, to the first
// trigger, after the mount. It renders no popup.
async function expectMenubarPage(page: Page, { hydrated }: { hydrated: boolean }) {
  expect(await readAttributes(page.getByTestId('menubar'), ['role', 'aria-orientation'])).toEqual({
    role: 'menubar',
    'aria-orientation': 'horizontal',
  });

  const attributeNames = ['role', 'aria-haspopup', 'aria-expanded', 'tabindex'];
  const trigger = { role: 'menuitem', 'aria-haspopup': 'menu', 'aria-expanded': 'false' };
  expect(await readAttributes(page.getByTestId('file'), attributeNames)).toEqual({
    ...trigger,
    tabindex: hydrated ? '0' : null,
  });
  expect(await readAttributes(page.getByTestId('edit'), attributeNames)).toEqual({
    ...trigger,
    tabindex: hydrated ? '-1' : null,
  });
  expect(await page.locator('[role="menu"]').count()).toBe(0);
}

// A server renders no popup. The trigger of an open root has the open state. The trigger of a
// handle has the closed form, because a handle holds its root only on the client.
async function expectPopoverPageOnServer(page: Page) {
  const attributeNames = ['aria-haspopup', 'aria-expanded', 'data-pressed'];
  const read = (testId: string) => readAttributes(page.getByTestId(testId), attributeNames);
  const closed = { 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'data-pressed': null };

  expect(await read('closed')).toEqual(closed);
  expect(await read('open')).toEqual({ ...closed, 'aria-expanded': 'true' });
  expect(await read('detached')).toEqual(closed);
  expect(await page.locator('[role="dialog"]').count()).toBe(0);
}

// After the mount, the open root renders its popup in `<body>`, and the trigger of the handle
// follows its root.
async function expectHydratedPopoverPage(page: Page) {
  const popup = page.getByTestId('open-popup');
  expect(await popup.count()).toBe(1);
  expect(await popup.evaluate((element) => element.parentElement?.parentElement?.localName)).toBe(
    'body',
  );
  expect(await popup.getAttribute('role')).toBe('dialog');
  expect(await popup.getAttribute('aria-labelledby')).toBe(
    await page.getByText('Open title').getAttribute('id'),
  );
  expect(await page.getByTestId('open').getAttribute('aria-controls')).toBe(
    await popup.getAttribute('id'),
  );

  expect(await page.getByTestId('closed').getAttribute('aria-expanded')).toBe('false');
  expect(await page.getByTestId('detached').getAttribute('aria-expanded')).toBe('false');
  expect(await page.getByTestId('closed-popup').count()).toBe(0);
  expect(await page.getByTestId('detached-popup').count()).toBe(0);
}

// A server renders no popup and no portal. Each trigger has the declaration that stops the callout
// of a long press in Safari on iOS. The trigger of the open root has the open state.
async function expectContextMenuPageOnServer(page: Page) {
  const attributeNames = ['style', 'data-popup-open', 'data-pressed'];
  const read = (testId: string) => readAttributes(page.getByTestId(testId), attributeNames);

  expect(await read('closed')).toEqual({
    style: '-webkit-touch-callout:none;',
    'data-popup-open': null,
    'data-pressed': null,
  });
  expect(await read('open')).toEqual({
    style: '-webkit-touch-callout:none;',
    'data-popup-open': '',
    'data-pressed': '',
  });
  expect(await page.locator('[role="menu"]').count()).toBe(0);
}

// After the mount, the open root renders its popup in `<body>`.
async function expectHydratedContextMenuPage(page: Page) {
  const popup = page.getByTestId('open-popup');
  expect(await popup.count()).toBe(1);
  expect(await popup.evaluate((element) => element.parentElement?.parentElement?.localName)).toBe(
    'body',
  );
  expect(await popup.getAttribute('role')).toBe('menu');
  expect(await page.getByTestId('open').getAttribute('data-popup-open')).toBe('');
  expect(await page.getByTestId('closed').getAttribute('data-popup-open')).toBeNull();
  expect(await page.getByTestId('closed-popup').count()).toBe(0);
}

const PREVIEW_CARD_LINK_ATTRIBUTES = [
  'href',
  'data-popup-open',
  'role',
  'aria-expanded',
  'tabindex',
];

// The link is a native link: the part adds no ARIA attribute, no `role` and no `tabindex`.
async function expectPreviewCardLinks(page: Page) {
  expect(await readElement(page.getByTestId('closed-link'), PREVIEW_CARD_LINK_ATTRIBUTES)).toEqual({
    tag: 'a',
    text: 'Closed link',
    attributes: {
      href: '#closed',
      'data-popup-open': null,
      role: null,
      'aria-expanded': null,
      tabindex: null,
    },
  });
  expect(await readAttributes(page.getByTestId('open-link'), ['id', 'data-popup-open'])).toEqual({
    id: 'open-link',
    'data-popup-open': '',
  });
}

// The portal renders after the mount, so the server HTML has no popup.
async function expectPreviewCardPageOnServer(page: Page) {
  await expectPreviewCardLinks(page);
  expect(await page.getByTestId('open-popup').count()).toBe(0);
}

// After the mount, the card that is open by default shows the payload of its link in the viewport.
async function expectHydratedPreviewCardPage(page: Page) {
  await expectPreviewCardLinks(page);
  expect(await page.getByTestId('closed-popup').count()).toBe(0);
  expect(await page.getByTestId('open-viewport').textContent()).toBe('Open preview');
}

// A server renders no popup. The trigger of an open root has the open state and names no popup,
// because a server renders no popup.
async function expectAlertDialogPageOnServer(page: Page) {
  const read = (testId: string) =>
    readAttributes(page.getByTestId(testId), ['aria-haspopup', 'aria-expanded']);
  const closed = { 'aria-haspopup': 'dialog', 'aria-expanded': 'false' };

  expect(await read('closed')).toEqual(closed);
  expect(await read('open')).toEqual({ ...closed, 'aria-expanded': 'true' });
  expect(await read('detached')).toEqual(closed);
  expect(await page.getByTestId('open').getAttribute('aria-controls')).toBeNull();
  expect(await page.locator('[role="alertdialog"]').count()).toBe(0);
}

// After the mount, the open root renders its popup in `<body>`. The title and the description
// label the popup.
async function expectHydratedAlertDialogPage(page: Page) {
  const popup = page.getByTestId('open-popup');
  expect(await popup.count()).toBe(1);
  expect(await popup.evaluate((element) => element.parentElement?.localName)).toBe('body');
  expect(await readAttributes(popup, ['role', 'aria-modal'])).toEqual({
    role: 'alertdialog',
    'aria-modal': 'true',
  });
  expect(await popup.getAttribute('aria-labelledby')).toBe(
    await page.getByTestId('open-title').getAttribute('id'),
  );
  expect(await popup.getAttribute('aria-describedby')).toBe(
    await page.getByTestId('open-description').getAttribute('id'),
  );
  expect(await page.getByTestId('open').getAttribute('aria-controls')).toBe(
    await popup.getAttribute('id'),
  );

  expect(await page.getByTestId('closed').getAttribute('aria-expanded')).toBe('false');
  expect(await page.getByTestId('detached').getAttribute('aria-expanded')).toBe('false');
  expect(await page.getByTestId('closed-popup').count()).toBe(0);
  expect(await page.getByTestId('detached-popup').count()).toBe(0);
}

const TOOLTIP_TRIGGERS = ['closed', 'open', 'kept', 'detached'];

function readTooltipTriggers(page: Page) {
  return Promise.all(
    TOOLTIP_TRIGGERS.map((testId) => page.getByTestId(testId).getAttribute('data-popup-open')),
  );
}

// A portal renders after the mount, so the server HTML has no popup. Only the trigger that the
// root names with `default-trigger-id` is open. On a server, a handle has no root, so a detached
// trigger is closed.
async function expectTooltipPageOnServer(page: Page) {
  expect(await page.locator('[data-testid$="-popup"]').count()).toBe(0);
  expect(await readTooltipTriggers(page)).toEqual([null, '', null, null]);
}

// After the mount, the two open popups and the kept popup are in their positioners in the body.
// The kept popup is hidden, and the detached trigger follows its root.
async function expectHydratedTooltipPage(page: Page) {
  const readPopup = (testId: string) =>
    page.getByTestId(testId).evaluate((element) => ({
      parent: element.parentElement?.parentElement?.localName,
      isVisible: element.checkVisibility(),
    }));

  expect(await page.getByTestId('closed-popup').count()).toBe(0);
  expect(await readPopup('open-popup')).toEqual({ parent: 'body', isVisible: true });
  expect(await readPopup('kept-popup')).toEqual({ parent: 'body', isVisible: false });
  expect(await readPopup('detached-popup')).toEqual({ parent: 'body', isVisible: true });
  expect(await readTooltipTriggers(page)).toEqual([null, '', null, '']);
}

async function expectDrawerPageOnServer(page: Page) {
  const triggerAttributes = ['aria-haspopup', 'aria-expanded'];
  expect(await readAttributes(page.getByTestId('closed-trigger'), triggerAttributes)).toEqual({
    'aria-haspopup': 'dialog',
    'aria-expanded': 'false',
  });
  expect(await readAttributes(page.getByTestId('open-trigger'), triggerAttributes)).toEqual({
    'aria-haspopup': 'dialog',
    'aria-expanded': 'true',
  });
  expect(
    await readAttributes(page.getByTestId('swipe-area'), [
      'role',
      'aria-hidden',
      'data-open',
      'data-swipe-direction',
    ]),
  ).toEqual({
    role: 'presentation',
    'aria-hidden': 'true',
    'data-open': null,
    'data-swipe-direction': 'up',
  });
  // A server render reports no drawer to the provider, so the indent is not active.
  expect(await readAttributes(page.getByTestId('indent'), ['data-active'])).toEqual({
    'data-active': null,
  });
  expect(await page.locator('[role="dialog"]').count()).toBe(0);
}

// After the mount, the open drawer renders its popup in `<body>` and reports to the provider.
async function expectHydratedDrawerPage(page: Page) {
  const popup = page.getByTestId('open-popup');
  expect(await popup.count()).toBe(1);
  expect(
    await popup.evaluate((element) => element.closest('main') === null && element.isConnected),
  ).toBe(true);
  expect(await popup.getAttribute('role')).toBe('dialog');
  expect(await popup.textContent()).toBe('Open title');
  expect(await readAttributes(page.getByTestId('indent'), ['data-active'])).toEqual({
    'data-active': '',
  });
  expect(await page.getByTestId('open-trigger').getAttribute('aria-expanded')).toBe('true');
  expect(await page.getByTestId('closed-trigger').getAttribute('aria-expanded')).toBe('false');
  expect(await page.getByTestId('closed-popup').count()).toBe(0);
}

async function expectDialogInPlacePageOnServer(page: Page) {
  const panel = page.getByTestId('panel');
  expect(await panel.getAttribute('role')).toBe('dialog');
  expect(await page.getByTestId('panel-title').textContent()).toBe('Panel title');
  expect(await page.locator('main > [data-testid="panel"]').count()).toBe(1);
  expect(await page.locator('body > [role="dialog"]').count()).toBe(0);
}

async function expectHydratedDialogInPlacePage(page: Page) {
  await expectDialogInPlacePageOnServer(page);
  const titleId = await page.getByTestId('panel-title').getAttribute('id');
  expect(titleId).not.toBe(null);
  expect(await page.getByTestId('panel').getAttribute('aria-labelledby')).toBe(titleId);
}

// A server renders no popup. The trigger of an open root has the open state. The trigger of a
// handle is closed, because a server gives no root to a handle.
async function expectDialogPageOnServer(page: Page) {
  const read = (testId: string) =>
    readAttributes(page.getByTestId(testId), ['aria-haspopup', 'aria-expanded']);
  const closed = { 'aria-haspopup': 'dialog', 'aria-expanded': 'false' };

  expect(await read('closed')).toEqual(closed);
  expect(await read('open')).toEqual({ ...closed, 'aria-expanded': 'true' });
  expect(await read('detached')).toEqual(closed);
  expect(await page.locator('[role="dialog"]').count()).toBe(0);
}

// After the mount, the open root renders its popup in `<body>`, named and described by its title
// and its description.
async function expectHydratedDialogPage(page: Page) {
  const popup = page.getByTestId('open-popup');
  expect(await popup.count()).toBe(1);
  expect(await popup.evaluate((element) => element.parentElement?.localName)).toBe('body');
  expect(await popup.getAttribute('role')).toBe('dialog');
  expect(await popup.getAttribute('aria-labelledby')).toBe(
    await page.getByTestId('open-title').getAttribute('id'),
  );
  expect(await popup.getAttribute('aria-describedby')).toBe(
    await page.getByTestId('open-description').getAttribute('id'),
  );
  expect(await page.getByTestId('open').getAttribute('aria-controls')).toBe(
    await popup.getAttribute('id'),
  );

  expect(await page.getByTestId('closed').getAttribute('aria-expanded')).toBe('false');
  expect(await page.getByTestId('detached').getAttribute('aria-expanded')).toBe('false');
  expect(await page.getByTestId('closed-popup').count()).toBe(0);
  expect(await page.getByTestId('detached-popup').count()).toBe(0);
}

// The server filters the list with `en-US`, so "malmo" keeps "Malmö" and no other city. The root
// renders the list and the input in the server HTML.
async function expectAutocompletePage(page: Page) {
  const input = page.getByTestId('input');
  expect(
    await readAttributes(input, ['role', 'aria-expanded', 'aria-autocomplete', 'name']),
  ).toEqual({
    role: 'combobox',
    'aria-expanded': 'true',
    'aria-autocomplete': 'list',
    name: 'city',
  });
  expect(await input.inputValue()).toBe('malmo');
  expect(await page.getByTestId('list').getAttribute('role')).toBe('listbox');
  expect(await page.getByRole('option').allTextContents()).toEqual(['Malmö']);
  expect(await readFormData(page)).toEqual(['city=malmo']);
}

// The server HTML has the value in the input, the chips of the selected values, the label that
// names the trigger, and the inputs of the form. A portal renders its popup after the mount, so
// the server HTML has no popup.
async function expectComboboxPageOnServer(page: Page) {
  expect(
    await readAttributes(page.getByTestId('fruit-input'), [
      'role',
      'aria-expanded',
      'aria-haspopup',
      'aria-autocomplete',
      'name',
    ]),
  ).toEqual({
    role: 'combobox',
    'aria-expanded': 'false',
    'aria-haspopup': 'listbox',
    'aria-autocomplete': 'list',
    name: null,
  });
  expect(await page.getByTestId('fruit-input').inputValue()).toBe('Banana');

  expect(await page.getByTestId('tags-chips').getAttribute('role')).toBe('toolbar');
  expect(
    (await page.getByTestId('tags-chip').allTextContents()).map((text) => text.trim()),
  ).toEqual(['b']);

  const labelId = await page.getByTestId('country-label').getAttribute('id');
  expect(labelId).toBeTruthy();
  expect(await page.getByTestId('country-trigger').getAttribute('aria-labelledby')).toBe(labelId);
  expect(await page.getByTestId('country-trigger').textContent()).toBe('Sweden');

  expect(await readFormData(page)).toEqual(['fruit=Banana', 'tags=b', 'country=Sweden']);
  expect(await page.getByRole('listbox').count()).toBe(0);
}

// The root assumes that the input is in the popup until its input mounts. After the mount, the
// trigger beside an input is a button with no role, as in a page that has no server HTML.
async function expectHydratedComboboxPage(page: Page) {
  await expectComboboxPageOnServer(page);
  expect(
    await readAttributes(page.getByTestId('fruit-trigger'), ['role', 'tabindex', 'aria-haspopup']),
  ).toEqual({ role: null, tabindex: '-1', 'aria-haspopup': 'listbox' });
}

const RESIZABLE_PANELS = ['p-a', 'p-b', 'p-c', 'l-a', 'l-b', 'c-a', 'c-b'];

function readResizablePanel(page: Page, testId: string) {
  return page.getByTestId(testId).evaluate((element) => {
    const { style } = element as HTMLElement;
    return {
      flex: style.flex,
      flexGrow: style.flexGrow,
      size: style.getPropertyValue('--resizable-panel-size'),
    };
  });
}

async function expectResizablePercentPanels(page: Page) {
  const panels = await Promise.all(['p-a', 'p-b', 'p-c'].map((id) => readResizablePanel(page, id)));
  expect(panels.map(({ flexGrow, size }) => [flexGrow, size])).toEqual([
    ['30', '30'],
    ['35', '35'],
    ['35', '35'],
  ]);
  expect(
    await page.getByTestId('percent').getByRole('separator').first().getAttribute('aria-valuenow'),
  ).toBe('30');
}

async function expectResizablePageOnServer(page: Page) {
  await expectResizablePercentPanels(page);
  // A server cannot measure the page, so the length stays a length until the mount.
  expect(await readResizablePanel(page, 'l-a')).toEqual({
    flex: '0 1 240px',
    flexGrow: '0',
    size: '',
  });
  expect((await readResizablePanel(page, 'l-b')).flexGrow).toBe('100');
}

async function expectHydratedResizablePage(page: Page) {
  await expectResizablePercentPanels(page);
  expect((await readResizablePanel(page, 'l-a')).flexGrow).toBe('40');
}

async function readResizableWidths(page: Page) {
  return Promise.all(
    RESIZABLE_PANELS.map(async (testId) => (await page.getByTestId(testId).boundingBox())?.width),
  );
}

interface PageCase {
  path: string;
  expectPage: (page: Page) => Promise<void>;
  // For a page that changes after the mount. `expectPage` then holds for the server HTML only.
  expectHydratedPage?: (page: Page) => Promise<void>;
  // The messages of the hydration. The default is none.
  hydrationMessages?: string[];
}

const PAGES: PageCase[] = [
  {
    path: '/button',
    expectPage: expectButtonPage,
    expectHydratedPage: (page) => expectButtonPage(page, { hydrated: true }),
  },
  { path: '/separator', expectPage: expectSeparatorPage },
  { path: '/as', expectPage: expectAsPage, expectHydratedPage: expectHydratedAsPage },
  ...RANGE_PAGES.map(({ path, rootAttributes }) => ({
    path,
    expectPage: (page: Page) => expectRangePage(page, rootAttributes),
  })),
  { path: '/fieldset', expectPage: expectFieldsetPage },
  { path: '/form', expectPage: expectFormPage },
  {
    path: '/collapsible',
    expectPage: expectCollapsiblePage,
    expectHydratedPage: (page) => expectCollapsiblePage(page, { hydrated: true }),
  },
  {
    path: '/accordion',
    expectPage: expectAccordionPage,
    expectHydratedPage: (page) => expectAccordionPage(page, { hydrated: true }),
  },
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
  {
    path: '/toggle-group',
    expectPage: expectToggleGroupPage,
    expectHydratedPage: expectHydratedToggleGroupPage,
  },
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
  {
    path: '/radio-group',
    expectPage: (page) => expectRadioGroupPage(page, { hydrated: false }),
    expectHydratedPage: (page) => expectRadioGroupPage(page, { hydrated: true }),
  },
  {
    path: '/slider',
    expectPage: expectSliderPage,
    expectHydratedPage: expectHydratedSliderPage,
  },
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
    expectPage: expectOTPFieldPageWithNativeLabel,
  },
  { path: '/calendar', expectPage: expectCalendarPage },
  {
    path: '/date-layout',
    expectPage: (page) => expectDateLayoutPage(page, { hydrated: false }),
    expectHydratedPage: (page) => expectDateLayoutPage(page, { hydrated: true }),
    // The face of the server has 24 numbers and that of the browser 12. Vue logs this message for
    // a list with another count of items, also under `data-allow-mismatch`.
    hydrationMessages: ['console error: Hydration completed but contains mismatches.'],
  },
  {
    path: '/date-field',
    expectPage: (page) => expectDateFieldPageWithNativeLabel(page, { hydrated: false }),
    expectHydratedPage: (page) => expectDateFieldPageWithNativeLabel(page, { hydrated: true }),
  },
  { path: '/date-picker', expectPage: expectDatePickerPage },
  { path: '/date-range-picker', expectPage: expectDateRangePickerPage },
  { path: '/time-picker', expectPage: expectTimePickerPage },
  { path: '/number-field', expectPage: expectNumberFieldPage },
  { path: '/providers', expectPage: expectProvidersPage },
  { path: '/use-render', expectPage: expectUseRenderPage },
  { path: '/unstable-use-media-query', expectPage: expectMediaQueryPage },
  {
    path: '/portal',
    expectPage: expectPortalPageOnServer,
    expectHydratedPage: expectHydratedPortalPage,
  },
  {
    path: '/toast',
    expectPage: expectToastPageOnServer,
    expectHydratedPage: expectHydratedToastPage,
  },
  { path: '/select', expectPage: expectSelectPage },
  {
    path: '/navigation-menu',
    expectPage: (page) => expectNavigationMenuPage(page, { hydrated: false }),
    expectHydratedPage: (page) => expectNavigationMenuPage(page, { hydrated: true }),
  },
  { path: '/menu', expectPage: expectMenuPageOnServer, expectHydratedPage: expectHydratedMenuPage },
  {
    path: '/menubar',
    expectPage: (page) => expectMenubarPage(page, { hydrated: false }),
    expectHydratedPage: (page) => expectMenubarPage(page, { hydrated: true }),
  },
  {
    path: '/context-menu',
    expectPage: expectContextMenuPageOnServer,
    expectHydratedPage: expectHydratedContextMenuPage,
  },
  {
    path: '/preview-card',
    expectPage: expectPreviewCardPageOnServer,
    expectHydratedPage: expectHydratedPreviewCardPage,
  },
  {
    path: '/popover',
    expectPage: expectPopoverPageOnServer,
    expectHydratedPage: expectHydratedPopoverPage,
  },
  {
    path: '/alert-dialog',
    expectPage: expectAlertDialogPageOnServer,
    expectHydratedPage: expectHydratedAlertDialogPage,
  },
  {
    path: '/tooltip',
    expectPage: expectTooltipPageOnServer,
    expectHydratedPage: expectHydratedTooltipPage,
  },
  {
    path: '/drawer',
    expectPage: expectDrawerPageOnServer,
    expectHydratedPage: expectHydratedDrawerPage,
  },
  {
    path: '/dialog-in-place',
    expectPage: expectDialogInPlacePageOnServer,
    expectHydratedPage: expectHydratedDialogInPlacePage,
  },
  {
    path: '/dialog',
    expectPage: expectDialogPageOnServer,
    expectHydratedPage: expectHydratedDialogPage,
  },
  { path: '/autocomplete', expectPage: expectAutocompletePage },
  {
    path: '/combobox',
    expectPage: expectComboboxPageOnServer,
    expectHydratedPage: expectHydratedComboboxPage,
  },
  {
    path: '/resizable',
    expectPage: expectResizablePageOnServer,
    expectHydratedPage: expectHydratedResizablePage,
  },
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
    'hydrates $path with only the messages of its case',
    async ({ path, expectPage, expectHydratedPage = expectPage, hydrationMessages = [] }) => {
      const page = await createPage();
      const messages = collectMessages(page);

      await page.goto(url(path), { waitUntil: 'hydration' });
      await waitForTwoFrames(page);

      expect(messages).toEqual(hydrationMessages);
      await expectHydratedPage(page);
    },
  );

  it('keeps the tab order of /dialog-in-place after hydration and closes on Escape', async () => {
    const page = await createPage('/dialog-in-place');
    const messages = collectMessages(page);
    await page.getByTestId('before').focus();

    await page.keyboard.press('Tab');

    expect(
      await page
        .getByTestId('panel-close')
        .evaluate((element) => element === document.activeElement),
    ).toBe(true);
    await page.keyboard.press('Escape');
    await page.getByTestId('panel').waitFor({ state: 'detached' });
    expect(messages).toEqual([]);
  });

  it('changes a switch on a click on its label and on the switch after hydration', async () => {
    const page = await createPage('/switch');
    const messages = collectMessages(page);

    await page.getByTestId('label').click();
    await page.getByTestId('wifi').click();

    expect(await page.getByTestId('notifications').isChecked()).toBe(true);
    expect(await page.getByTestId('wifi').isChecked()).toBe(false);
    expect(await page.getByTestId('wifi-value').textContent()).toBe('false');
    expect((await readSwitchPage(page)).formData).toEqual(['notifications=on']);
    expect(messages).toEqual([]);
  });

  it('changes a checkbox on a click on its label and on the checkbox after hydration', async () => {
    const page = await createPage('/checkbox');
    const messages = collectMessages(page);

    await page.getByTestId('label').click();
    await page.getByTestId('news').click();

    expect(await page.getByTestId('terms').isChecked()).toBe(true);
    expect(await page.getByTestId('news').isChecked()).toBe(false);
    expect(await page.getByTestId('news-value').textContent()).toBe('false');
    expect((await readCheckboxPage(page)).formData).toEqual(['terms=on']);
    expect(messages).toEqual([]);
  });

  it('selects a radio of /radio-group with a click and with an arrow key after hydration', async () => {
    const page = await createPage('/radio-group');
    const messages = collectMessages(page);
    const readFocusedTestId = () =>
      page.evaluate(() => document.activeElement?.getAttribute('data-testid'));

    await page.getByTestId('apple').click();

    expect(await readCheckedRadios(page, 'fruit')).toEqual([true, false, false]);
    expect(await readRadios(page, 'fruit', 'tabindex')).toEqual([null, '-1', '-1']);
    expect(await page.getByTestId('value').textContent()).toBe('apple');
    expect(await readFormData(page)).toEqual(['fruit=apple']);

    await page.keyboard.press('ArrowDown');

    expect(await readFocusedTestId()).toBe('banana');
    expect(await readCheckedRadios(page, 'fruit')).toEqual([false, true, false]);
    expect(await readRadios(page, 'fruit', 'tabindex')).toEqual(['-1', null, '-1']);
    expect(await page.getByTestId('value').textContent()).toBe('banana');
    expect(await readFormData(page)).toEqual(['fruit=banana']);
    expect(messages).toEqual([]);
  });

  it('changes the checkboxes of /checkbox-group with three clicks on the parent and a click on a child after hydration', async () => {
    const page = await createPage('/checkbox-group');
    const messages = collectMessages(page);
    const expectSelection = async (parent: string, selected: string[]) => {
      expect(await readCheckboxGroupPage(page)).toMatchObject({
        parentState: parent,
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

  it('adds a toast to /toast after hydration, and positions an anchored toast against its anchor', async () => {
    const page = await createPage('/toast');
    const messages = collectMessages(page);

    await page.getByTestId('add').click();
    const toast = page.getByTestId('toast');
    await toast.waitFor();
    const titleId = await page.getByTestId('title').getAttribute('id');
    expect(titleId).toBeTruthy();
    expect(await toast.getAttribute('aria-labelledby')).toBe(titleId);

    const anchor = page.getByTestId('anchor');
    await anchor.click();
    const positioner = page.getByTestId('anchored-positioner');
    await positioner.waitFor();
    await expect.poll(() => positioner.getAttribute('data-side')).toBe('bottom');
    expect(await page.getByTestId('arrow').getAttribute('data-side')).toBe('bottom');
    const anchorBox = await anchor.boundingBox();
    await expect
      .poll(async () => (await positioner.boundingBox())?.y)
      .toBeCloseTo(anchorBox!.y + anchorBox!.height + 8, 0);
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

  it('shows the years, the months and the days of /calendar, and selects a day and a month, after hydration', async () => {
    const page = await createPage('/calendar');
    const messages = collectMessages(page);
    const days = page.getByTestId('days');

    await page.getByTestId('days-year').click();
    expect(await days.getAttribute('data-view')).toBe('year');
    await days.getByRole('gridcell', { name: '2027' }).click();
    expect(await days.getAttribute('data-view')).toBe('month');
    await days.getByRole('gridcell', { name: 'March 2027' }).click();

    expect(await days.getAttribute('data-view')).toBe('day');
    expect(await days.getAttribute('aria-label')).toBe('March 2027');
    await days.getByRole('button', { name: /March 5, 2027/ }).click();
    expect(await page.getByTestId('day-value').textContent()).toBe('2027-03-05');

    const months = page.getByTestId('months');
    await months.getByRole('gridcell', { name: 'November 2026' }).click();
    expect(await page.getByTestId('month-value').textContent()).toBe('2026-11');
    expect(await readSelected(months)).toEqual(['November 2026']);
    expect(messages).toEqual([]);
  });

  it('keeps the text of /calendar in en-US for a visitor in de-DE after hydration', async () => {
    const page = await createPage(undefined, { locale: 'de-DE' });
    const messages = collectMessages(page);

    await page.goto(url('/calendar'), { waitUntil: 'hydration' });
    await waitForTwoFrames(page);

    const days = page.getByTestId('days');
    expect(await days.getAttribute('aria-label')).toBe('November 2026');
    expect(await days.locator('[data-date="2026-11-10"] button').getAttribute('aria-label')).toBe(
      'Tuesday, November 10, 2026',
    );
    expect(messages).toEqual([]);
  });

  it('changes the time and date of /date-layout after hydration', async () => {
    const page = await createPage('/date-layout');
    const messages = collectMessages(page);
    const hours = page.getByTestId('clock').getByRole('slider');

    await hours.press('ArrowRight');

    // The clock of the browser has 12 hours, and the time stays after noon.
    expect(await hours.inputValue()).toBe('2');
    expect(await page.getByTestId('time-value').textContent()).toBe('14:45:00');

    await page.getByTestId('calendar').locator('[data-date="2026-11-15"] button').click();

    expect(await page.getByTestId('date-value').textContent()).toBe('2026-11-15');
    expect(messages).toEqual([]);
  });

  it('types a date into /date-field, and clears it with the Clear button, after hydration', async () => {
    const page = await createPage('/date-field');
    const messages = collectMessages(page);
    const readFocusedTestId = () =>
      page.evaluate(() => document.activeElement?.getAttribute('data-testid'));

    await page.getByTestId('when-month').click();
    await page.keyboard.type('12');

    expect(await readFocusedTestId()).toBe('when-day');
    expect(await readDateFieldValues(page, 'when')).toEqual(['12', '14', '2026']);
    expect(await page.getByTestId('when-value').textContent()).toBe('2026-12-14');
    expect(await readFormData(page)).toEqual(['when=2026-12-14']);

    await page.getByTestId('when-clear').click();

    expect(await readFocusedTestId()).toBe('when-month');
    expect(await readDateFieldValues(page, 'when')).toEqual(['', '', '']);
    expect(await page.getByTestId('when-value').textContent()).toBe('');
    expect(await readFormData(page)).toEqual(['when=']);

    await page.getByTestId('card-label').click();

    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-type'))).toBe(
      'month',
    );
    expect(messages).toEqual([]);
  });

  it('opens the popup of /date-picker, focuses the day, and selects a day, after hydration', async () => {
    const page = await createPage('/date-picker');
    const messages = collectMessages(page);
    const readFocusedDate = () =>
      page.evaluate(() =>
        document.activeElement?.closest('[data-date]')?.getAttribute('data-date'),
      );

    await page.getByTestId('when-trigger').click();
    await page.getByTestId('when-popup').waitFor();

    expect(await page.getByTestId('when-trigger').getAttribute('aria-expanded')).toBe('true');
    await page.waitForFunction(
      () =>
        document.activeElement?.closest('[data-date]')?.getAttribute('data-date') === '2026-11-10',
    );
    expect(await readFocusedDate()).toBe('2026-11-10');

    await page.getByRole('button', { name: /November 12, 2026/ }).click();

    await page.getByTestId('when-popup').waitFor({ state: 'detached' });
    expect(await page.getByTestId('when-value').textContent()).toBe('2026-11-12');
    expect(await readDateFieldValues(page, 'when')).toEqual(['11', '12', '2026']);
    expect(await readFormData(page)).toEqual(['when=2026-11-12']);
    expect(await page.getByTestId('when-trigger').getAttribute('aria-label')).toBe(
      'Change date, Thursday, November 12, 2026',
    );
    expect(messages).toEqual([]);
  });

  it('opens the popup of /date-range-picker, picks two days, and closes it, after hydration', async () => {
    const page = await createPage('/date-range-picker');
    const messages = collectMessages(page);
    const readFocusedDate = () =>
      page.evaluate(() =>
        document.activeElement?.closest('[data-date]')?.getAttribute('data-date'),
      );

    await page.getByTestId('when-trigger').click();
    await page.getByTestId('when-popup').waitFor();

    expect(await page.getByTestId('when-trigger').getAttribute('aria-expanded')).toBe('true');
    await page.waitForFunction(
      () =>
        document.activeElement?.closest('[data-date]')?.getAttribute('data-date') === '2026-11-10',
    );
    expect(await readFocusedDate()).toBe('2026-11-10');

    await page.getByRole('button', { name: /November 14, 2026/ }).click();

    // The first press starts the range, and the popup stays open for the second press.
    expect(await page.getByTestId('when-value').textContent()).toBe('2026-11-14 ');
    expect(await readDateFieldValues(page, 'to')).toEqual(['', '', '']);
    expect(await page.getByTestId('when-popup').count()).toBe(1);

    await page.getByRole('button', { name: /November 18, 2026/ }).click();

    await page.getByTestId('when-popup').waitFor({ state: 'detached' });
    expect(await page.getByTestId('when-value').textContent()).toBe('2026-11-14 2026-11-18');
    expect(await readDateFieldValues(page, 'from')).toEqual(['11', '14', '2026']);
    expect(await readDateFieldValues(page, 'to')).toEqual(['11', '18', '2026']);
    expect(await readFormData(page)).toEqual(['from=2026-11-14', 'to=2026-11-18']);
    expect(await readTriggerName(page)).toBe(
      'Change dates, Saturday, November 14 – Wednesday, November 18, 2026',
    );
    expect(messages).toEqual([]);
  });

  it('opens the popup of /time-picker, focuses the selected time, and selects a time, after hydration', async () => {
    const page = await createPage('/time-picker');
    const messages = collectMessages(page);
    const options = page.getByTestId('start-list').getByRole('option');

    await page.getByTestId('start-trigger').click();
    await page.getByTestId('start-popup').waitFor();

    expect(await page.getByTestId('start-trigger').getAttribute('aria-expanded')).toBe('true');
    expect(await options.count()).toBe(24);
    await page.waitForFunction(
      () => document.activeElement?.getAttribute('aria-selected') === 'true',
    );
    expect(await page.evaluate(() => document.activeElement?.textContent)).toBe(formatTime(15));

    await options.nth(16).click();

    await page.getByTestId('start-popup').waitFor({ state: 'detached' });
    expect(await page.getByTestId('start-value').textContent()).toBe('16:00:00');
    expect(await readDateFieldValues(page, 'start')).toEqual(['4', '00', 'PM']);
    expect(await readFormData(page)).toEqual(['start=16:00']);
    expect(await page.getByTestId('start-trigger').getAttribute('aria-label')).toBe(
      `Change time, ${formatTime(16)}`,
    );
    expect(messages).toEqual([]);
  });

  it('moves the thumb of /scroll-area when its viewport scrolls after hydration', async () => {
    const page = await createPage('/scroll-area');
    const thumb = page.getByTestId('thumb');
    await page.getByTestId('corner').waitFor();
    const readTranslate = () => thumb.evaluate((element) => element.style.translate);
    const initialTranslate = await readTranslate();

    await page.getByTestId('viewport').evaluate((element) => {
      element.scrollTop = 400;
    });
    await page.waitForFunction(
      ([testId, previous]) =>
        document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.style.translate !==
        previous,
      ['thumb', initialTranslate],
    );

    const offsetY = Number(/^0px ([\d.]+)px$/.exec(await readTranslate())?.[1]);
    expect(offsetY).toBeGreaterThan(0);
  });

  it('has the edge thumbs of /slider in their control when the files of the app do not load', async () => {
    const page = await createPage();
    await page.route('**/_nuxt/**', (route) => route.abort());

    await page.goto(url('/slider'), { waitUntil: 'domcontentloaded' });
    expect((await readSliderPage(page)).priceThumbs).toEqual(EDGE_THUMBS);
  });

  it('changes the value of /slider with the keyboard and with a click on its control after hydration', async () => {
    const page = await createPage('/slider');
    const messages = collectMessages(page);

    await page.getByTestId('volume-thumb').locator('input').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Shift+ArrowRight');

    expect(await page.getByTestId('volume-model').textContent()).toBe('41');
    expect(await page.getByTestId('volume-value').textContent()).toBe('41');

    const box = (await page.getByTestId('volume-control').boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);

    expect(await page.getByTestId('volume-model').textContent()).toBe('75');
    expect((await readSliderPage(page)).formData).toEqual(['volume=75', 'price=25', 'price=75']);
    expect(messages).toEqual([]);
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
    'keeps the text of $path in the locale of each root for a visitor in de-DE after hydration',
    async ({ path, rootAttributes }) => {
      const page = await createPage(undefined, { locale: 'de-DE' });
      const messages = collectMessages(page);

      await page.goto(url(path), { waitUntil: 'hydration' });
      await waitForTwoFrames(page);

      const visitorText = await page.evaluate(() =>
        new Intl.NumberFormat(undefined, { style: 'percent' }).format(0.42),
      );
      expect(visitorText).not.toBe(PERCENT_TEXT);
      expect(await page.getByTestId('percent-value').textContent()).toBe(PERCENT_TEXT);
      expect(await page.getByTestId('percent-root').getAttribute('aria-valuetext')).toBe(
        PERCENT_TEXT,
      );
      await expectCurrencyRoot(page, rootAttributes);
      await expectProviderRoot(page);
      expect(messages).toEqual([]);
    },
  );

  it('keeps the en-US text of /number-field for a visitor with another locale', async () => {
    const page = await createPage(undefined, { locale: 'de-DE' });
    const messages = collectMessages(page);

    await page.goto(url('/number-field'), { waitUntil: 'hydration' });
    await waitForTwoFrames(page);

    expect(await page.getByTestId('label-first-control').inputValue()).toBe(EURO_TEXT);
    expect(await page.getByTestId('label-last-control').inputValue()).toBe('7');
    expect(await readFormData(page)).toEqual(['amount=1234.5', 'quantity=7']);
    expect(messages).toEqual([]);
  });

  it('filters the items of /autocomplete while typing after hydration', async () => {
    const page = await createPage('/autocomplete');
    const messages = collectMessages(page);

    await page.getByTestId('input').fill('ma');

    expect(await page.getByRole('option').allTextContents()).toEqual(['Malmö', 'Malta']);
    expect(await readFormData(page)).toEqual(['city=ma']);
    expect(messages).toEqual([]);
  });

  it('filters the items of /combobox while typing after hydration, and selects an item', async () => {
    const page = await createPage('/combobox');
    const messages = collectMessages(page);
    const input = page.getByTestId('fruit-input');
    const popup = page.getByTestId('fruit-popup');

    await input.fill('ch');
    await popup.waitFor({ state: 'visible' });

    expect(await popup.evaluate((element) => element.closest('main') === null)).toBe(true);
    expect(await page.getByRole('option').allTextContents()).toEqual(['Cherry']);

    await page.getByRole('option', { name: 'Cherry' }).click();
    await popup.waitFor({ state: 'detached' });

    expect(await input.inputValue()).toBe('Cherry');
    expect(await readFormData(page)).toEqual(['fruit=Cherry', 'tags=b', 'country=Sweden']);
    expect(messages).toEqual([]);
  });

  it('renders the layout of the cookie of /resizable on a server', async () => {
    const cookie = {
      name: 'resizable-layout',
      value: encodeURIComponent(JSON.stringify({ 'c-a': '180px', 'c-b': 70 })),
      url: url('/'),
    };
    const serverPage = await createPage(undefined, { javaScriptEnabled: false });
    await serverPage.context().addCookies([cookie]);

    await serverPage.goto(url('/resizable'));

    expect((await readResizablePanel(serverPage, 'c-a')).flex).toBe('0 1 180px');

    const page = await createPage();
    await page.context().addCookies([cookie]);
    const messages = collectMessages(page);

    await page.goto(url('/resizable'), { waitUntil: 'hydration' });
    await waitForTwoFrames(page);

    const { width } = (await page.getByTestId('c-a').boundingBox())!;
    expect(Math.abs(width - 180)).toBeLessThanOrEqual(1);
    expect(messages).toEqual([]);
  });

  it('renders the layout of /resizable on a server for a cookie with a size that is not valid', async () => {
    const cookie = {
      name: 'resizable-layout',
      value: encodeURIComponent(JSON.stringify({ 'c-a': '1fr', 'c-b': 70 })),
      url: url('/'),
    };
    const serverPage = await createPage(undefined, { javaScriptEnabled: false });
    await serverPage.context().addCookies([cookie]);

    await serverPage.goto(url('/resizable'));

    expect((await readResizablePanel(serverPage, 'c-a')).flexGrow).toBe('30');
    expect((await readResizablePanel(serverPage, 'c-b')).flexGrow).toBe('70');

    const page = await createPage();
    await page.context().addCookies([cookie]);
    const messages = collectMessages(page);

    await page.goto(url('/resizable'), { waitUntil: 'hydration' });
    await waitForTwoFrames(page);

    expect((await readResizablePanel(page, 'c-a')).flexGrow).toBe('30');
    expect(messages).toEqual(
      dev
        ? [
            'console warning: Vase UI: The layout gives the panel "c-a" the size "1fr", which is not valid. The root ignores this size, so the panel takes its `defaultSize`, or an equal share of the space that is left. Use a number of 0 or more, or a string of such a number with an optional unit: "%", "px", "em", "rem", "vh" or "vw".',
          ]
        : [],
    );
  });

  it('keeps each panel rectangle of /resizable when the scripts run', async () => {
    const serverPage = await createPage(undefined, { javaScriptEnabled: false });
    await serverPage.goto(url('/resizable'));
    const serverWidths = await readResizableWidths(serverPage);

    const page = await createPage();
    const messages = collectMessages(page);
    await page.goto(url('/resizable'), { waitUntil: 'hydration' });
    await waitForTwoFrames(page);
    const widths = await readResizableWidths(page);

    expect(serverWidths).toHaveLength(RESIZABLE_PANELS.length);
    for (const [index, width] of widths.entries()) {
      expect(Math.abs(width! - serverWidths[index]!)).toBeLessThanOrEqual(1);
    }
    expect(messages).toEqual([]);
  });

  it('saves the layout of /resizable in its cookie after a key on the handle', async () => {
    const page = await createPage();
    const messages = collectMessages(page);
    await page.goto(url('/resizable'), { waitUntil: 'hydration' });
    await waitForTwoFrames(page);

    await page.getByTestId('cookie-handle').focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.cookie.includes('resizable-layout='));

    const cookie = await page.evaluate(() =>
      decodeURIComponent(
        document.cookie
          .split('; ')
          .find((entry) => entry.startsWith('resizable-layout='))!
          .slice('resizable-layout='.length),
      ),
    );
    expect(JSON.parse(cookie)).toEqual({ 'c-a': '156px', 'c-b': 74 });
    expect(messages).toEqual([]);
  });

  it('shows the stored layout of /resizable after the mount', async () => {
    const page = await createPage();
    const messages = collectMessages(page);
    await page.addInitScript(() => {
      localStorage.setItem('nuxt-resizable', JSON.stringify({ 's-a': 20, 's-b': 80 }));
    });

    await page.goto(url('/resizable'), { waitUntil: 'hydration' });
    await waitForTwoFrames(page);

    expect((await readResizablePanel(page, 's-a')).flexGrow).toBe('20');
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

  it('opens a context menu for a right click on its trigger after hydration', async () => {
    const page = await createPage('/context-menu');
    const messages = collectMessages(page);
    const trigger = page.getByTestId('closed');
    const popup = page.getByTestId('closed-popup');

    // The open menu is modal. Its backdrop covers the page until Escape closes the menu.
    await page.getByTestId('open-popup').waitFor();
    await page.keyboard.press('Escape');
    await page.getByTestId('open-popup').waitFor({ state: 'detached' });
    expect(await popup.count()).toBe(0);

    await trigger.click({ button: 'right' });
    await popup.waitFor();

    expect(await trigger.getAttribute('data-popup-open')).toBe('');
    expect(await popup.getAttribute('role')).toBe('menu');
    expect(await popup.evaluate((element) => element.closest('main') === null)).toBe(true);
    expect(messages).toEqual([]);
  });

  it('opens a menu of /menubar on a click and the next menu with ArrowRight after hydration', async () => {
    const page = await createPage('/menubar');
    const messages = collectMessages(page);

    await page.getByTestId('file').click();
    await page.getByTestId('file-popup').waitFor();

    expect(await page.getByTestId('file').getAttribute('aria-expanded')).toBe('true');

    await page.keyboard.press('ArrowRight');
    await page.getByTestId('edit-popup').waitFor();
    await page.getByTestId('file-popup').waitFor({ state: 'detached' });

    expect(await page.getByTestId('edit').getAttribute('aria-expanded')).toBe('true');
    expect(messages).toEqual([]);
  });

  it('opens the card of /preview-card on a hover of its link after hydration', async () => {
    const page = await createPage('/preview-card');
    const messages = collectMessages(page);
    const link = page.getByTestId('closed-link');

    await link.hover();
    await page.getByTestId('closed-popup').waitFor();

    expect(await link.getAttribute('data-popup-open')).toBe('');
    expect(await page.getByTestId('closed-popup').textContent()).toBe('Closed preview');
    expect(messages).toEqual([]);
  });

  it('opens the closed drawer of /drawer on a click of its trigger after hydration', async () => {
    const page = await createPage('/drawer');
    const messages = collectMessages(page);
    const trigger = page.getByTestId('closed-trigger');

    await trigger.click();
    await page.getByTestId('closed-popup').waitFor();

    expect(await trigger.getAttribute('aria-expanded')).toBe('true');
    expect(await page.getByTestId('closed-popup').getAttribute('role')).toBe('dialog');
    expect(messages).toEqual([]);
  });

  it('opens the dialog of /dialog on a click on its trigger after hydration, and closes it on Escape', async () => {
    const page = await createPage('/dialog');
    const messages = collectMessages(page);
    const trigger = page.getByTestId('closed');

    await trigger.click();
    const popup = page.getByTestId('closed-popup');
    await popup.waitFor({ state: 'visible' });

    expect(await trigger.getAttribute('aria-expanded')).toBe('true');
    await expect
      .poll(() => popup.evaluate((element) => element.contains(document.activeElement)))
      .toBe(true);

    await page.keyboard.press('Escape');
    await popup.waitFor({ state: 'detached' });

    await expect
      .poll(() => trigger.evaluate((element) => element === document.activeElement))
      .toBe(true);
    expect(messages).toEqual([]);
  });

  it('keeps the alert dialog of /alert-dialog open on a press outside, closes it with its close button, and opens a detached trigger with its payload after hydration', async () => {
    const page = await createPage('/alert-dialog');
    const messages = collectMessages(page);
    const openPopup = page.getByTestId('open-popup');
    await openPopup.waitFor();

    await page.mouse.click(1, 1);
    await waitForTwoFrames(page);
    expect(await openPopup.count()).toBe(1);

    await page.getByTestId('open-close').click();
    await openPopup.waitFor({ state: 'detached' });
    expect(await page.getByTestId('open').getAttribute('aria-expanded')).toBe('false');

    await page.getByTestId('detached').click();
    const detachedPopup = page.getByTestId('detached-popup');
    await detachedPopup.waitFor();
    expect(await detachedPopup.getAttribute('role')).toBe('alertdialog');
    expect(await detachedPopup.textContent()).toBe('Detached payload');
    expect(await page.getByTestId('detached').getAttribute('aria-expanded')).toBe('true');

    await page.keyboard.press('Escape');
    await detachedPopup.waitFor({ state: 'detached' });
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
