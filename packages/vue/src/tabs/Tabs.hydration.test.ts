import { describe, expect, inject, onTestFinished, test } from 'vitest';
import { nextTick } from 'vue';
import TabsIndicatorLayouts from '../../test/fixtures/TabsIndicatorLayouts.vue';
import TabsParts from '../../test/fixtures/TabsParts.vue';
import { renderOnServer as renderHtmlOnServer } from '../../test/hydration';
import { hydrate, mount, renderOnServer, settle } from '../../test/render';
import { script } from './prehydrationScript.min';

const items = (...keys: string[]) => keys.map((key) => ({ key }));

function tabStops(root: Element) {
  return [...root.querySelectorAll<HTMLElement>('[role=tab]')]
    .filter((tab) => tab.tabIndex === 0)
    .map((tab) => tab.dataset.key);
}

function openPanels(root: Element) {
  return [...root.querySelectorAll<HTMLElement>('[role=tabpanel]:not([hidden])')].map(
    (panel) => panel.dataset.key,
  );
}

describe('the tabs', () => {
  const firstDisabled = [{ key: 'a', attrs: { disabled: true } }, ...items('b', 'c')];
  test.each([
    { name: 'a defaultValue', root: { defaultValue: 'b' }, server: ['b'], mounted: ['b'] },
    {
      name: 'a value, vertical',
      root: { modelValue: 'c', orientation: 'vertical' },
      server: ['c'],
      mounted: ['c'],
    },
    {
      name: 'an active disabled tab',
      root: { modelValue: 'a' },
      tabs: firstDisabled,
      server: ['a'],
      mounted: ['a'],
    },
    { name: 'a value of null', root: { modelValue: null }, server: ['a'], mounted: ['a'] },
    {
      name: 'a defaultValue of null, first disabled',
      root: { defaultValue: null },
      tabs: firstDisabled,
      server: ['a'],
      mounted: ['a'],
    },
    { name: 'no value', root: {}, server: ['a'], mounted: ['a'], open: ['a'] },
    {
      name: 'no value, first disabled',
      tabs: firstDisabled,
      server: ['b'],
      mounted: ['b'],
      open: ['b'],
    },
    // A tab knows only the tabs before it, so no tab knows that no tab has the value.
    { name: 'a value that no tab has', root: { modelValue: 'z' }, server: [], mounted: ['a'] },
  ])(
    'have the tab stop and the first value in the server HTML, and hydrate with no message: $name',
    async ({ root: rootProps, tabs = items('a', 'b', 'c'), server, mounted, open }) => {
      const props = { root: rootProps, tabs };
      const root = await renderOnServer('TabsParts', props);
      expect(tabStops(root)).toEqual(server);
      if (open) expect(openPanels(root)).toEqual(open);
      hydrate(TabsParts, props, root);
      await settle();
      expect(tabStops(root)).toEqual(mounted);
    },
  );

  test('with numbers and no value, the first tab is active in the server HTML', async () => {
    const props = { tabs: [0, 1, 2].map((value) => ({ key: `tab${value}`, value })) };
    const root = await renderOnServer('TabsParts', props);
    expect(root.querySelector('[aria-selected=true]')).toHaveAttribute('data-key', 'tab0');
    expect(openPanels(root)).toEqual(['tab0']);
  });

  test('the server HTML has the open panel, a kept panel with hidden and inert, and no other panel', async () => {
    const props = {
      root: { defaultValue: 'a' },
      tabs: items('a', 'b', 'c'),
      panels: [{ key: 'a' }, { key: 'b', attrs: { keepMounted: true } }, { key: 'c' }],
    };
    const root = await renderOnServer('TabsParts', props);
    const [open, kept] = root.querySelectorAll('[role=tabpanel]');
    expect(open).toHaveAttribute('tabindex', '0');
    expect(open).not.toHaveAttribute('hidden');
    expect(open).not.toHaveAttribute('inert');
    expect(kept).toHaveAttribute('hidden');
    expect(kept).toHaveAttribute('inert');
    expect(root.querySelector('[data-key=c][role=tabpanel]')).toBeNull();
    hydrate(TabsParts, props, root);
    await nextTick();
    expect(root.querySelectorAll('[role=tabpanel]')[0]).toBe(open);
  });

  test.each([
    { name: 'panels after the list', panelsFirst: false },
    { name: 'panels before the list', panelsFirst: true },
  ])(
    'the server HTML names the part that comes before; the hydration gives each name: $name',
    async ({ panelsFirst }) => {
      const props = { root: { defaultValue: 'a' }, tabs: items('a', 'b'), panelsFirst };
      const root = await renderOnServer('TabsParts', props);
      const tab = root.querySelector<HTMLElement>('[role=tab][data-key=a]')!;
      const panel = root.querySelector<HTMLElement>('[role=tabpanel][data-key=a]')!;
      expect(tab.getAttribute('aria-controls')).toBe(panelsFirst ? panel.id : null);
      expect(panel.getAttribute('aria-labelledby')).toBe(panelsFirst ? null : tab.id);
      hydrate(TabsParts, props, root);
      await nextTick();
      expect(tab).toHaveAttribute('aria-controls', panel.id);
      expect(panel).toHaveAttribute('aria-labelledby', tab.id);
    },
  );
});

describe('the indicator', () => {
  const layout = {
    root: { modelValue: 2 },
    listStyle: 'display: flex; position: relative; width: 300px',
    tabs: [1, 2].map((value) => ({
      value,
      style: 'width: 100px; height: 40px; padding: 0; border: 0',
    })),
  };
  // The second tab of the list is active.
  const variables = {
    left: '100px',
    right: '100px',
    top: '0px',
    bottom: '0px',
    width: '100px',
    height: '40px',
  };

  function readVariables(indicator: HTMLElement) {
    return Object.fromEntries(
      Object.keys(variables).map((name) => [
        name,
        indicator.style.getPropertyValue(`--active-tab-${name}`),
      ]),
    );
  }

  // `innerHTML` runs no inline script. A fragment of a range runs it.
  async function insertServerHtml(props: Record<string, unknown>) {
    const html = await renderHtmlOnServer('test/fixtures/TabsIndicatorLayouts.vue', props);
    const root = document.body.appendChild(document.createElement('div'));
    onTestFinished(() => root.remove());
    const range = document.createRange();
    range.selectNodeContents(root);
    root.append(range.createContextualFragment(html));
    return { root, html, indicator: root.querySelector<HTMLElement>('.Indicator')! };
  }

  test('with no script is hidden in the server HTML, and measures the active tab after the mount', async () => {
    const root = await renderOnServer('TabsIndicatorLayouts', layout);
    const indicator = root.querySelector<HTMLElement>('.Indicator')!;
    expect(indicator).toHaveAttribute('hidden');
    expect(indicator).toHaveAttribute('role', 'presentation');
    expect(indicator).not.toHaveAttribute('style');
    expect(indicator).not.toHaveAttribute('data-allow-mismatch');
    expect(root.querySelector('script')).toBeNull();
    hydrate(TabsIndicatorLayouts, layout, root);
    await settle();
    expect(readVariables(indicator)).toEqual(variables);
    expect(indicator).not.toHaveAttribute('hidden');
  });

  test.each([
    { name: 'its element', slotted: false },
    { name: 'the element slot', slotted: true },
  ])(
    'with renderBeforeHydration is placed by the script of the server HTML before the app starts: $name',
    async ({ slotted }) => {
      const props = {
        ...layout,
        slotted,
        nonce: 'abc',
        indicator: { renderBeforeHydration: true },
      };
      const { root, html, indicator } = await insertServerHtml(props);
      // In the element, the script is the last child. With the element slot, it follows the element.
      const scriptElement = root.querySelector('script')!;
      expect(slotted ? scriptElement.previousElementSibling : scriptElement.parentElement).toBe(
        indicator,
      );
      expect(scriptElement.nonce).toBe('abc');
      expect(html).toContain(script);
      expect(indicator).toHaveAttribute('data-allow-mismatch', 'style,attribute');
      expect(readVariables(indicator)).toEqual(variables);
      expect(indicator).not.toHaveAttribute('hidden');

      hydrate(TabsIndicatorLayouts, props, root);
      await settle();
      expect(root.querySelector('script')).toBeNull();
      expect(root.querySelector('.Indicator')).toBe(indicator);
      expect(readVariables(indicator)).toEqual(variables);
      expect(indicator).not.toHaveAttribute('data-allow-mismatch');
    },
  );

  test('hydrates a style of the developer on the indicator that the script changed', async () => {
    const props = { ...layout, indicator: { renderBeforeHydration: true, style: 'height: 3px' } };
    const { root, indicator } = await insertServerHtml(props);
    hydrate(TabsIndicatorLayouts, props, root);
    await settle();
    expect(indicator.style.height).toBe('3px');
    expect(readVariables(indicator)).toEqual(variables);
  });

  // Vue 3.6.0-rc.16 runs no `<Suspense>` in a Vapor app with Vapor parts.
  test.skipIf(inject('app') === 'vapor')(
    'hydrates with no message when its list is mounted before it',
    async () => {
      const props = { ...layout, late: true };
      const root = await renderOnServer('TabsIndicatorLayouts', props);
      const indicator = root.querySelector<HTMLElement>('.Indicator')!;
      hydrate(TabsIndicatorLayouts, props, root);
      for (let tick = 0; tick < 10 && indicator.hasAttribute('hidden'); tick++) await settle();
      expect(readVariables(indicator)).toEqual(variables);
      expect(root.querySelector('.Indicator')).toBe(indicator);
    },
  );

  test('renders no indicator and no script for a value of null', async () => {
    const props = {
      ...layout,
      root: { modelValue: null },
      indicator: { renderBeforeHydration: true },
    };
    const root = await renderOnServer('TabsIndicatorLayouts', props);
    expect(root.querySelector('.Indicator')).toBeNull();
    expect(root.querySelector('script')).toBeNull();
  });

  test('the script has no closing script tag in its text', () => {
    expect(script.toLowerCase()).not.toContain('</script');
  });

  test.each([
    { name: 'its element', slotted: false },
    { name: 'the element slot', slotted: true },
  ])(
    'VUE-60: a scoped rule of the developer matches the indicator with renderBeforeHydration: $name',
    async ({ slotted }) => {
      const { root } = mount(TabsIndicatorLayouts, {
        ...layout,
        slotted,
        indicator: { renderBeforeHydration: true },
      });
      await nextTick();
      expect(getComputedStyle(root.querySelector('.Indicator')!).outlineStyle).toBe('dashed');
    },
  );
});
