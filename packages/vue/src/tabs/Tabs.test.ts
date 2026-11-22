import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { markRaw, nextTick, reactive } from 'vue';
import type { TabsRootChangeEventDetails } from '@vase-ui/vue/tabs';
import { dataAttributes } from '../../test/field';
import TabsElements from '../../test/fixtures/TabsElements.vue';
import TabsInPopups from '../../test/fixtures/TabsInPopups.vue';
import TabsInTransition from '../../test/fixtures/TabsInTransition.vue';
import TabsPartOutside from '../../test/fixtures/TabsPartOutside.vue';
import TabsParts from '../../test/fixtures/TabsParts.vue';
import { screen } from '../../test/queries';
import { waitForLaterMillisecond } from '../../test/createRenderer';
import { mount, mountError, settle } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { waitFor } from '../../test/waitFor';

type Item = { key: string; value?: unknown; attrs?: Record<string, unknown> };

const items = (...keys: string[]): Item[] => keys.map((key) => ({ key }));

/** A log for a fixture, which adds each entry to `entries`. */
const recorder = (entries: string[]) => ({ add: (entry: string) => entries.push(entry) });

interface Setup {
  root?: Record<string, unknown>;
  list?: Record<string, unknown>;
  tabs: Item[];
  panels?: Item[];
  indicator?: Record<string, unknown>;
  panelsFirst?: boolean;
  dir?: string;
}

async function mountTabs(setup: Setup) {
  const { root, exposed } = mount(TabsParts, setup as unknown as Record<string, unknown>);
  await nextTick();
  const keyOf = (element: Element | null | undefined) => element?.getAttribute('data-key') ?? null;
  const tabs = () => [...root.querySelectorAll<HTMLElement>('[role=tab]')];
  return {
    root,
    exposed,
    list: root.querySelector<HTMLElement>('[role=tablist]')!,
    tab: (key: string) => root.querySelector<HTMLElement>(`[role=tab][data-key="${key}"]`)!,
    panel: (key: string) => root.querySelector<HTMLElement>(`[role=tabpanel][data-key="${key}"]`),
    selected: () =>
      tabs()
        .filter((tab) => tab.ariaSelected === 'true')
        .map(keyOf),
    tabStops: () =>
      tabs()
        .filter((tab) => tab.tabIndex === 0)
        .map(keyOf),
    openPanels: () =>
      [...root.querySelectorAll('[role=tabpanel]:not([hidden])')].map((panel) => keyOf(panel)),
    focused: () => keyOf(document.activeElement),
  };
}

/** Props of a root that write each event in `log`, with `v-model` unless `write` is false. */
function rootModel(log: string[], modelValue: unknown, write = true) {
  const root = reactive<Record<string, unknown>>({
    modelValue,
    onValueChange: (value: unknown, details: TabsRootChangeEventDetails) =>
      log.push(`valueChange ${String(value)} ${details.reason}`),
  });
  root['onUpdate:modelValue'] = (value: unknown) => {
    log.push(`update ${String(value)}`);
    if (write) root.modelValue = value;
  };
  return root;
}

/** Props of an uncontrolled root that write each event in `log`. */
function rootEvents(log: string[], props: Record<string, unknown> = {}) {
  return reactive<Record<string, unknown>>({
    ...props,
    onValueChange: (value: unknown, details: TabsRootChangeEventDetails) =>
      log.push(`valueChange ${String(value)} ${details.reason}`),
    'onUpdate:modelValue': (value: unknown) => log.push(`update ${String(value)}`),
  });
}

async function press(...keys: string[]) {
  for (const key of keys) await userEvent.keyboard(key);
  await nextTick();
}

describe('the parts', () => {
  test('render a div, a tablist, buttons and panels with their roles; a template ref has element; the attributes of the developer win', async () => {
    const { root, exposed, tab, panel } = await mountTabs({
      root: { defaultValue: 'a', class: 'Tabs' },
      list: { 'aria-label': 'Sections', role: 'navigation' },
      tabs: [{ key: 'a', attrs: { type: 'submit' } }, { key: 'b' }],
      indicator: {},
    });
    const element = root.querySelector('.Tabs')!;
    expect(element.tagName).toBe('DIV');
    expect(exposed.root.element).toBe(element);
    expect(exposed.list.element).toHaveAttribute('role', 'navigation');
    expect(exposed.list.element).toHaveAttribute('aria-label', 'Sections');
    expect(exposed.indicator.element.tagName).toBe('SPAN');
    expect(tab('a').tagName).toBe('BUTTON');
    expect(tab('a')).toHaveAttribute('type', 'submit');
    expect(tab('b')).toHaveAttribute('type', 'button');
    expect(panel('a')!.tagName).toBe('DIV');
  });

  test('write the orientation and the direction; ARIA attributes and [hidden] say the other states', async () => {
    const root = reactive<Record<string, unknown>>({ defaultValue: 'a' });
    const { list, tab, panel, exposed } = await mountTabs({
      root,
      tabs: [{ key: 'a' }, { key: 'b', attrs: { disabled: true } }],
      panels: [{ key: 'a' }, { key: 'b', attrs: { keepMounted: true } }],
      indicator: {},
    });
    const indicator = exposed.indicator.element as HTMLElement;
    const rootElement = exposed.root.element as HTMLElement;
    const shared = ['data-activation-direction', 'data-orientation'];
    expect(dataAttributes(rootElement)).toEqual(shared);
    expect(dataAttributes(list)).toEqual(['data-activation-direction']);
    expect(dataAttributes(tab('a'))).toEqual([
      'data-activation-direction',
      'data-key',
      'data-orientation',
    ]);
    expect(dataAttributes(panel('b')!)).toEqual([
      'data-activation-direction',
      'data-key',
      'data-orientation',
    ]);
    expect(dataAttributes(indicator)).toEqual(shared);
    expect(rootElement).toHaveAttribute('data-orientation', 'horizontal');
    expect(list).not.toHaveAttribute('aria-orientation');
    expect(tab('a')).toHaveAttribute('aria-selected', 'true');
    expect(tab('b')).toHaveAttribute('aria-selected', 'false');
    expect(tab('b')).toHaveAttribute('aria-disabled', 'true');
    expect(tab('b')).not.toHaveAttribute('disabled');
    expect(tab('a')).not.toHaveAttribute('aria-disabled');
    expect(panel('a')).not.toHaveAttribute('hidden');
    expect(panel('a')).toHaveAttribute('tabindex', '0');
    expect(panel('b')).toHaveAttribute('hidden');
    expect(panel('b')).toHaveAttribute('inert');
    expect(panel('b')).not.toHaveAttribute('tabindex');
    expect(indicator).toHaveAttribute('role', 'presentation');
    root.orientation = 'vertical';
    await nextTick();
    expect(list).toHaveAttribute('aria-orientation', 'vertical');
    for (const element of [rootElement, tab('a'), panel('a')!, indicator]) {
      expect(element).toHaveAttribute('data-orientation', 'vertical');
    }
  });

  test('can be named via `aria-label`', async () => {
    await mountTabs({ list: { 'aria-label': 'Sections' }, tabs: items('a') });
    expect(screen.getByRole('tablist', { name: 'Sections' })).toBeInTheDocument();
  });

  test('can be named via `aria-labelledby`', async () => {
    const { root } = await mountTabs({ list: { 'aria-labelledby': 'before' }, tabs: items('a') });
    expect(root.querySelector('[role=tablist]')).toHaveAccessibleName('Before');
  });

  test('render the element of the `element` slot with the props, the ref and the state', async () => {
    const { root, exposed } = mount(TabsElements, { root: { defaultValue: 'link' } });
    await nextTick();
    const section = root.querySelector('section')!;
    const link = root.querySelector('a')!;
    expect(exposed.root.element).toBe(section);
    expect(section).toHaveAttribute('data-state', 'horizontal');
    expect(exposed.list.element.tagName).toBe('NAV');
    expect(exposed.list.element).toHaveAttribute('role', 'tablist');
    expect(exposed.link.element).toBe(link);
    expect(link).toHaveAttribute('role', 'tab');
    expect(link).toHaveAttribute('data-state', 'true');
    expect(link).not.toHaveAttribute('type');
    expect(root.querySelector('span[role=tab]')).not.toHaveAttribute('type');
    expect(exposed.panel.element.tagName).toBe('ARTICLE');
    expect(exposed.panel.element).toHaveAttribute('data-state', 'false');
    expect(exposed.indicator.element.tagName).toBe('I');
  });
});

describe('the value', () => {
  test('a tab is active when its value is strictly the value of the root; values can have each type', async () => {
    const value = () => 'a function';
    // A reactive prop would give a proxy of the object, which is not strictly the object.
    const object = markRaw({});
    const symbol = Symbol('4');
    const pattern = markRaw(/5/);
    const root = reactive<Record<string, unknown>>({ modelValue: 1 });
    const { tab, panel, selected, openPanels } = await mountTabs({
      root,
      tabs: [
        { key: 'one', value: 1 },
        { key: 'text', value: '1' },
        { key: 'function', value },
        { key: 'object', value: object },
        { key: 'symbol', value: symbol },
        { key: 'pattern', value: pattern },
      ],
    });
    expect(selected()).toEqual(['one']);
    expect(openPanels()).toEqual(['one']);
    for (const [next, key] of [
      ['1', 'text'],
      [value, 'function'],
      [object, 'object'],
      [symbol, 'symbol'],
      [pattern, 'pattern'],
    ] as const) {
      root.modelValue = next;
      await nextTick();
      expect(selected()).toEqual([key]);
      expect(openPanels()).toEqual([key]);
      expect(panel(key)).toHaveAttribute('aria-labelledby', tab(key).id);
    }
    root.modelValue = null;
    await nextTick();
    expect(selected()).toEqual([]);
    expect(openPanels()).toEqual([]);
  });

  test('a click emits one valueChange and one update:modelValue; a click on the active tab emits nothing', async () => {
    const log: string[] = [];
    const details: TabsRootChangeEventDetails[] = [];
    const root = rootModel(log, 'a');
    root.onValueChange = (value: unknown, given: TabsRootChangeEventDetails) => {
      log.push(`valueChange ${String(value)}`);
      details.push(given);
    };
    const { tab, selected, openPanels } = await mountTabs({ root, tabs: items('a', 'b') });
    await userEvent.click(tab('a'));
    await userEvent.click(tab('b'));
    expect(log).toEqual(['valueChange b', 'update b']);
    expect(details[0]!.reason).toBe('none');
    expect(details[0]!.event.type).toBe('click');
    expect(details[0]!.activationDirection).toBe('right');
    expect(selected()).toEqual(['b']);
    expect(openPanels()).toEqual(['b']);
  });

  test('a cancel keeps the value; a controlled root shows its prop again when the parent does not write it', async () => {
    const log: string[] = [];
    const root = rootModel(log, 'a', false);
    const { tab, selected } = await mountTabs({ root, tabs: items('a', 'b', 'c') });
    await userEvent.click(tab('b'));
    expect(log).toEqual(['valueChange b none', 'update b']);
    expect(selected()).toEqual(['a']);
    root.onValueChange = (_: unknown, details: TabsRootChangeEventDetails) => details.cancel();
    root.modelValue = undefined;
    await nextTick();
    await userEvent.click(tab('c'));
    expect(log).toEqual(['valueChange b none', 'update b']);
    expect(selected()).toEqual(['a']);
  });

  test('a function in defaultValue is the value of its tab; the root does not call it', async () => {
    const log: string[] = [];
    const value = () => 'b';
    const { selected } = await mountTabs({
      root: rootEvents(log, { defaultValue: value }),
      tabs: [{ key: 'a' }, { key: 'function', value }, { key: 'b' }],
    });
    await settle();
    expect(selected()).toEqual(['function']);
    expect(log).toEqual([]);
  });

  test('an uncontrolled root keeps its value; undefined from a parent keeps the value that the root has', async () => {
    const root = reactive<Record<string, unknown>>({ modelValue: 'b' });
    const { tab, selected } = await mountTabs({ root, tabs: items('a', 'b', 'c') });
    root.modelValue = undefined;
    await nextTick();
    expect(selected()).toEqual(['b']);
    await userEvent.click(tab('c'));
    expect(selected()).toEqual(['c']);
  });
});

describe('the first value', () => {
  test.each([
    { name: 'the first tab', disabled: [], active: 'a' },
    { name: 'a disabled first tab', disabled: ['a'], active: 'b' },
    { name: 'two disabled tabs', disabled: ['a', 'b'], active: 'c' },
  ])(
    'with no defaultValue is the first tab that is not disabled; the root emits it with initial after the mount: $name',
    async ({ disabled, active }) => {
      const log: string[] = [];
      const details: TabsRootChangeEventDetails[] = [];
      const root = rootEvents(log, { defaultValue: undefined });
      root.onValueChange = (value: unknown, given: TabsRootChangeEventDetails) => {
        log.push(`valueChange ${String(value)} ${given.reason}`);
        details.push(given);
      };
      const tabs = ['a', 'b', 'c'].map((key) => ({
        key,
        attrs: { disabled: disabled.includes(key) },
      }));
      const { selected, openPanels } = await mountTabs({ root, tabs });
      expect(log).toEqual([`valueChange ${active} initial`, `update ${active}`]);
      expect(details[0]!.activationDirection).toBe('none');
      expect(selected()).toEqual([active]);
      expect(openPanels()).toEqual([active]);
    },
  );

  test('a list whose tab of value 0 is not first starts on its first tab', async () => {
    const log: string[] = [];
    const { selected } = await mountTabs({
      root: rootEvents(log),
      tabs: [
        { key: 'one', value: 1 },
        { key: 'zero', value: 0 },
      ],
    });
    expect(log).toEqual(['valueChange 1 initial', 'update 1']);
    expect(selected()).toEqual(['one']);
  });

  test("v-model on an empty ref gets the first tab with 'initial'", async () => {
    const log: string[] = [];
    const root = rootModel(log, undefined);
    const { selected } = await mountTabs({ root, tabs: items('a', 'b') });
    expect(log).toEqual(['valueChange a initial', 'update a']);
    expect(root.modelValue).toBe('a');
    expect(selected()).toEqual(['a']);
  });

  test('is null when each tab is disabled; a tab that becomes enabled later changes nothing', async () => {
    const log: string[] = [];
    const tabs = reactive(
      ['a', 'b'].map((key) => ({ key, attrs: { disabled: true } as Record<string, unknown> })),
    );
    const { selected, tabStops } = await mountTabs({ root: rootEvents(log), tabs });
    expect(log).toEqual(['valueChange null initial', 'update null']);
    expect(selected()).toEqual([]);
    expect(tabStops()).toEqual(['a']);
    tabs[1]!.attrs = { disabled: false };
    await settle();
    expect(log).toHaveLength(2);
    expect(selected()).toEqual([]);
  });

  test('a defaultValue, also null, emits nothing at the mount', async () => {
    const log: string[] = [];
    await mountTabs({ root: rootEvents(log, { defaultValue: 'b' }), tabs: items('a', 'b') });
    await mountTabs({ root: rootEvents(log, { defaultValue: null }), tabs: items('a', 'b') });
    await settle();
    expect(log).toEqual([]);
  });

  test('a root with no tabs waits for its first tabs, and keeps its defaultValue until then', async () => {
    const log: string[] = [];
    const tabs = reactive<Item[]>([]);
    const { selected } = await mountTabs({ root: rootEvents(log, { defaultValue: 'b' }), tabs });
    const implicit = await mountTabs({ root: rootEvents(log), tabs });
    await settle();
    expect(log).toEqual([]);
    tabs.push(...items('a', 'b'));
    await settle();
    expect(selected()).toEqual(['b']);
    expect(implicit.selected()).toEqual(['a']);
    expect(log).toEqual(['valueChange a initial', 'update a']);
  });
});

describe('the changes that the root makes', () => {
  test("a disabled active tab gives the first tab that is not disabled, with 'disabled'; also with keepMounted panels", async () => {
    const log: string[] = [];
    const tabs = reactive<Item[]>(items('a', 'b', 'c'));
    const panels = items('a', 'b', 'c').map((panel) => ({
      ...panel,
      attrs: { keepMounted: true },
    }));
    const { selected, openPanels } = await mountTabs({
      root: rootEvents(log, { defaultValue: 'b' }),
      tabs,
      panels,
    });
    tabs[1]!.attrs = { disabled: true };
    await settle();
    expect(log).toEqual(['valueChange a disabled', 'update a']);
    expect(selected()).toEqual(['a']);
    expect(openPanels()).toEqual(['a']);
  });

  test('a defaultValue that names a disabled tab stays until that tab is enabled one time', async () => {
    const log: string[] = [];
    const root = rootEvents(log, { defaultValue: 'b' });
    const tabs = reactive<Item[]>([{ key: 'a' }, { key: 'b', attrs: { disabled: true } }]);
    const { selected, tabStops } = await mountTabs({ root, tabs });
    expect(selected()).toEqual(['b']);
    expect(tabStops()).toEqual(['b']);
    root.defaultValue = 'a';
    await settle();
    expect(selected()).toEqual(['b']);
    tabs[1]!.attrs = { disabled: false };
    await settle();
    tabs[1]!.attrs = { disabled: true };
    await settle();
    expect(log).toEqual(['valueChange a disabled', 'update a']);
    expect(selected()).toEqual(['a']);
  });

  test('only the defaultValue stays on a disabled tab: a tab that the user chooses and that becomes disabled in the same tick gives way', async () => {
    const log: string[] = [];
    const tabs = reactive<Item[]>([
      { key: 'a' },
      { key: 'b', attrs: { disabled: true } },
      { key: 'c' },
    ]);
    const { tab, selected } = await mountTabs({
      root: rootEvents(log, { defaultValue: 'b' }),
      tabs,
    });
    tab('c').click();
    tabs[2]!.attrs = { disabled: true };
    await settle();
    expect(log).toEqual(['valueChange c none', 'update c', 'valueChange a disabled', 'update a']);
    expect(selected()).toEqual(['a']);
  });

  test("a value that no tab has gives the first tab that is not disabled, or null, with 'missing'", async () => {
    const log: string[] = [];
    const tabs = reactive<Item[]>(items('a', 'b', 'c'));
    const { selected, tabStops } = await mountTabs({
      root: rootEvents(log, { defaultValue: 'b' }),
      tabs,
    });
    tabs.splice(1, 1);
    await settle();
    expect(log).toEqual(['valueChange a missing', 'update a']);
    expect(selected()).toEqual(['a']);
    expect(tabStops()).toEqual(['a']);
    tabs.splice(0, 2);
    await settle();
    expect(log.slice(2)).toEqual(['valueChange null missing', 'update null']);
    tabs.push(...items('d'));
    await settle();
    expect(log).toHaveLength(4);

    log.length = 0;
    await mountTabs({ root: rootEvents(log, { defaultValue: 'z' }), tabs: items('a', 'b') });
    await settle();
    expect(log).toEqual(['valueChange a missing', 'update a']);
  });

  test('a kept panel whose tabs all leave is hidden and names no tab', async () => {
    const log: string[] = [];
    const tabs = reactive<Item[]>(items('a'));
    const { panel } = await mountTabs({
      root: rootEvents(log, { defaultValue: 'a' }),
      tabs,
      panels: [{ key: 'a', attrs: { keepMounted: true } }],
    });
    expect(panel('a')).not.toHaveAttribute('hidden');
    tabs.splice(0, 1);
    await settle();
    expect(log).toEqual(['valueChange null missing', 'update null']);
    expect(panel('a')).toHaveAttribute('hidden');
    expect(panel('a')).not.toHaveAttribute('aria-labelledby');
  });

  test('emits nothing when the fallback is the value that the root has', async () => {
    const log: string[] = [];
    const tabs = reactive<Item[]>([
      { key: 'first', value: 'b' },
      { key: 'second', value: 'b' },
    ]);
    const { selected } = await mountTabs({ root: rootEvents(log, { defaultValue: 'b' }), tabs });
    tabs[0]!.attrs = { disabled: true };
    await settle();
    expect(log).toEqual([]);
    expect(selected()).toEqual(['first', 'second']);
  });

  test('a change of the root emits valueChange and always update:modelValue; cancel() has no effect; the event is a new Event', async () => {
    const log: string[] = [];
    const details: TabsRootChangeEventDetails[] = [];
    const root = rootEvents(log);
    root.onValueChange = (value: unknown, given: TabsRootChangeEventDetails) => {
      given.cancel();
      details.push(given);
      log.push(`valueChange ${String(value)} ${given.reason}`);
    };
    const tabs = reactive<Item[]>(items('a', 'b'));
    const { selected } = await mountTabs({ root, tabs });
    tabs.splice(0, 1);
    await settle();
    expect(log).toEqual(['valueChange a initial', 'update a', 'valueChange b missing', 'update b']);
    expect(
      details.map(
        ({ event, activationDirection }) =>
          `${event.type} ${event.isTrusted} ${activationDirection}`,
      ),
    ).toEqual(['vase-ui false none', 'vase-ui false none']);
    expect(selected()).toEqual(['b']);
  });

  test('a controlled root never changes its value: a disabled or a removed active tab keeps it', async () => {
    const log: string[] = [];
    const tabs = reactive<Item[]>(items('a', 'b', 'c'));
    const { selected, tabStops } = await mountTabs({ root: rootModel(log, 'b'), tabs });
    tabs[1]!.attrs = { disabled: true };
    await settle();
    expect(selected()).toEqual(['b']);
    expect(tabStops()).toEqual(['b']);
    tabs.splice(1, 1);
    await settle();
    expect(log).toEqual([]);
    expect(tabStops()).toEqual(['a']);
  });

  test('emits valueChange with null when the last tab leaves with a Transition', async () => {
    const log: string[] = [];
    const scene = reactive({ shown: true });
    mount(TabsInTransition, { root: rootEvents(log, { defaultValue: 'a' }), scene });
    await nextTick();
    scene.shown = false;
    await settle();
    expect(log).toEqual(['valueChange null missing', 'update null']);
  });
});

describe('activation', () => {
  test('a press and a click from a script give the tab the focus, so the arrow keys continue from it', async () => {
    const { tab, focused } = await mountTabs({
      root: { defaultValue: 'a' },
      tabs: items('a', 'b', 'c'),
    });
    await userEvent.click(tab('b'));
    expect(focused()).toBe('b');
    await press('{ArrowRight}');
    expect(focused()).toBe('c');
    tab('a').click();
    expect(focused()).toBe('a');
  });

  test('Enter and Space activate the focused tab', async () => {
    const { tab, selected } = await mountTabs({
      root: { defaultValue: 'a' },
      tabs: items('a', 'b', 'c'),
    });
    tab('b').focus();
    await press('{Enter}');
    expect(selected()).toEqual(['b']);
    tab('c').focus();
    await press(' ');
    expect(selected()).toEqual(['c']);
  });

  test('Space activates a button tab at its release, as a native button', async () => {
    const { tab, selected } = await mountTabs({
      root: { defaultValue: 'a' },
      tabs: items('a', 'b'),
    });
    tab('b').focus();
    await userEvent.keyboard('[Space>]');
    expect(selected()).toEqual(['a']);
    await press('[/Space]');
    expect(selected()).toEqual(['b']);
  });

  test('a focus, also from a script and with activateOnFocus, activates nothing', async () => {
    const log: string[] = [];
    const { tab } = await mountTabs({
      root: rootEvents(log, { defaultValue: null }),
      list: { activateOnFocus: true },
      tabs: items('a', 'b'),
    });
    tab('b').focus();
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    await userEvent.keyboard('{Tab}');
    await settle();
    expect(log).toEqual([]);
  });

  test('a press of the right or the middle button activates nothing, also with activateOnFocus', async () => {
    const log: string[] = [];
    const { tab } = await mountTabs({
      root: rootModel(log, 'a'),
      list: { activateOnFocus: true },
      tabs: items('a', 'b'),
    });
    tab('b').addEventListener('contextmenu', (event) => event.preventDefault());
    await userEvent.click(tab('b'), { button: 'right' });
    await userEvent.click(tab('b'), { button: 'middle' });
    expect(log).toEqual([]);
    await userEvent.click(tab('b'));
    expect(log).toEqual(['valueChange b none', 'update b']);
  });

  test('a disabled tab runs no click listener on the tab, and its click does not bubble to an ancestor; its keydown and pointerdown listeners run', async () => {
    const log: string[] = [];
    const { root, tab, selected, focused } = await mountTabs({
      root: rootEvents(log, { defaultValue: 'a' }),
      tabs: [
        { key: 'a' },
        {
          key: 'b',
          attrs: {
            disabled: true,
            onClick: () => log.push('tab click'),
            onKeydown: (event: KeyboardEvent) => log.push(`tab ${event.key}`),
            onPointerdown: () => log.push('tab pointerdown'),
          },
        },
      ],
    });
    root.addEventListener('click', () => log.push('ancestor click'));
    // A disabled tab is not actionable for Playwright, so the press needs `force`.
    await userEvent.click(tab('b'), { force: true });
    tab('b').focus();
    await press('{Enter}', ' ');
    expect(log).toEqual(['tab pointerdown', 'tab Enter', 'tab  ']);
    expect(selected()).toEqual(['a']);
    await press('{ArrowLeft}');
    expect(focused()).toBe('a');
  });
});

describe('keys', () => {
  const layouts = [
    {
      name: 'horizontal',
      orientation: 'horizontal',
      next: '{ArrowRight}',
      previous: '{ArrowLeft}',
    },
    { name: 'vertical', orientation: 'vertical', next: '{ArrowDown}', previous: '{ArrowUp}' },
    {
      name: 'horizontal, right to left',
      orientation: 'horizontal',
      dir: 'rtl',
      next: '{ArrowLeft}',
      previous: '{ArrowRight}',
    },
  ];

  test.each(layouts)(
    'the arrows move the focus and loop, Home and End go to the ends, and a disabled tab takes the focus: $name',
    async ({ orientation, dir, next, previous }) => {
      const log: string[] = [];
      const { tab, focused, selected, list } = await mountTabs({
        root: rootEvents(log, { defaultValue: 'a', orientation }),
        tabs: [{ key: 'a' }, { key: 'b', attrs: { disabled: true } }, { key: 'c' }],
        dir,
      });
      // A key that the list handles does not scroll the page.
      const prevented: boolean[] = [];
      list.addEventListener('keydown', (event) => prevented.push(event.defaultPrevented));
      tab('a').focus();
      const steps: (string | null)[] = [];
      for (const key of [next, next, next, previous, '{End}', '{Home}']) {
        await press(key);
        steps.push(focused());
      }
      expect(steps).toEqual(['b', 'c', 'a', 'c', 'c', 'a']);
      expect(prevented).toEqual([true, true, true, true, true, true]);
      expect(selected()).toEqual(['a']);
      expect(log).toEqual([]);
    },
  );

  test.each(layouts)(
    'with activateOnFocus, each key that moves the focus emits one valueChange with its keydown; a disabled tab is not activated: $name',
    async ({ orientation, dir, next, previous }) => {
      const log: string[] = [];
      const events: string[] = [];
      const root = rootModel(log, 'a');
      root.orientation = orientation;
      root.onValueChange = (value: unknown, details: TabsRootChangeEventDetails) => {
        log.push(`valueChange ${String(value)}`);
        events.push(`${details.event.type} ${(details.event as KeyboardEvent).key}`);
      };
      const { tab, focused, selected } = await mountTabs({
        root,
        list: { activateOnFocus: true },
        tabs: [{ key: 'a' }, { key: 'b' }, { key: 'c', attrs: { disabled: true } }],
        dir,
      });
      tab('a').focus();
      await press(next);
      expect([focused(), selected()]).toEqual(['b', ['b']]);
      await press(next);
      expect([focused(), selected()]).toEqual(['c', ['b']]);
      await press(previous, '{Home}');
      expect(log).toEqual(['valueChange b', 'update b', 'valueChange a', 'update a']);
      expect(events[0]).toBe(`keydown ${next.slice(1, -1)}`);
    },
  );

  test.each(layouts)(
    'with activateOnFocus, the keys that loop and End activate the tab that they focus: $name',
    async ({ orientation, dir, next, previous }) => {
      const log: string[] = [];
      const root = rootModel(log, 'a');
      root.orientation = orientation;
      const { tab, focused, selected } = await mountTabs({
        root,
        list: { activateOnFocus: true },
        tabs: items('a', 'b', 'c'),
        dir,
      });
      tab('a').focus();
      const steps: unknown[] = [];
      for (const key of [previous, next, '{End}', previous]) {
        await press(key);
        steps.push([focused(), selected()]);
      }
      expect(steps).toEqual([
        ['c', ['c']],
        ['a', ['a']],
        ['c', ['c']],
        ['b', ['b']],
      ]);
      expect(log).toEqual([
        'valueChange c none',
        'update c',
        'valueChange a none',
        'update a',
        'valueChange c none',
        'update c',
        'valueChange b none',
        'update b',
      ]);
    },
  );

  test.each([false, true])(
    'Home and End focus a disabled first and last tab and activate nothing (activateOnFocus: %s)',
    async (activateOnFocus) => {
      const log: string[] = [];
      const { tab, focused, selected } = await mountTabs({
        root: rootEvents(log, { defaultValue: 'b' }),
        list: { activateOnFocus },
        tabs: [
          { key: 'a', attrs: { disabled: true } },
          { key: 'b' },
          { key: 'c', attrs: { disabled: true } },
        ],
      });
      tab('b').focus();
      await press('{Home}');
      expect([focused(), selected()]).toEqual(['a', ['b']]);
      await press('{End}');
      expect([focused(), selected()]).toEqual(['c', ['b']]);
      expect(log).toEqual([]);
    },
  );

  test.each([false, true])(
    'a parent that writes the value one microtask later keeps the focus and the value together (activateOnFocus: %s)',
    async (activateOnFocus) => {
      const log: string[] = [];
      const root = rootModel(log, 'a', false);
      root['onUpdate:modelValue'] = (value: unknown) => {
        log.push(`update ${String(value)}`);
        void Promise.resolve().then(() => (root.modelValue = value));
      };
      const { tab, focused, selected } = await mountTabs({
        root,
        list: { activateOnFocus },
        tabs: [{ key: 'a' }, { key: 'b', attrs: { disabled: true } }, { key: 'c' }],
      });
      tab('a').focus();
      await press('{ArrowRight}');
      expect([focused(), selected()]).toEqual(['b', ['a']]);
      await press('{ArrowRight}');
      if (!activateOnFocus) {
        expect(log).toEqual([]);
        await press('{Enter}');
      }
      await waitFor(() => expect(selected()).toEqual(['c']));
      expect(focused()).toBe('c');
      expect(log).toEqual(['valueChange c none', 'update c']);
    },
  );

  test('without loopFocus, the arrows stop at the first and at the last tab', async () => {
    const { tab, focused } = await mountTabs({
      root: { defaultValue: 'a' },
      list: { loopFocus: false },
      tabs: items('a', 'b'),
    });
    tab('a').focus();
    await press('{ArrowLeft}');
    expect(focused()).toBe('a');
    await press('{ArrowRight}', '{ArrowRight}');
    expect(focused()).toBe('b');
  });

  test('the keys of the other orientation, and each key with Shift, Ctrl, Alt or Meta, do nothing', async () => {
    const log: string[] = [];
    const { tab, focused } = await mountTabs({
      root: rootEvents(log, { defaultValue: 'a' }),
      list: { activateOnFocus: true },
      tabs: items('a', 'b'),
    });
    tab('a').focus();
    // A real Alt or Meta with an arrow can move the page in its history.
    const events = ['shiftKey', 'ctrlKey', 'altKey', 'metaKey'].map(
      (modifier) =>
        new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
          cancelable: true,
          [modifier]: true,
        }),
    );
    for (const event of events) tab('a').dispatchEvent(event);
    await press('{ArrowDown}', '{ArrowUp}');
    expect(focused()).toBe('a');
    expect(log).toEqual([]);
    expect(events.map((event) => event.defaultPrevented)).toEqual([false, false, false, false]);
  });

  test('skip a tab that the browser disables or does not render', async () => {
    const { tab, focused } = await mountTabs({
      root: { defaultValue: 'a' },
      tabs: [{ key: 'a' }, { key: 'hidden', attrs: { hidden: true } }, { key: 'c' }],
    });
    tab('a').focus();
    await press('{ArrowRight}');
    expect(focused()).toBe('c');
    await press('{ArrowLeft}');
    expect(focused()).toBe('a');

    const { root } = mount(TabsElements, { root: { defaultValue: 'link' } });
    await nextTick();
    root.querySelector<HTMLElement>('span[role=tab]')!.focus();
    await press('{ArrowRight}');
    expect(document.activeElement).toHaveTextContent('Button');
    await press('{ArrowLeft}');
    expect(document.activeElement).toHaveTextContent('Span');
  });

  test('follow the order of the elements in the document at the key press', async () => {
    const tabs = reactive<Item[]>(items('a', 'b', 'c'));
    const { tab, focused } = await mountTabs({ root: { defaultValue: 'a' }, tabs });
    tabs.reverse();
    await nextTick();
    tab('a').focus();
    await press('{ArrowRight}');
    expect(focused()).toBe('c');
  });

  test('a handled key reaches a keydown listener on the tab and on the list, and no ancestor', async () => {
    const log: string[] = [];
    mount(TabsInPopups, { host: 'toolbar', log: recorder(log) });
    await nextTick();
    screen.getByRole('tab', { name: 'Overview' }).focus();
    await press('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Projects' }));
    expect(log).toEqual(['tab ArrowRight', 'list ArrowRight']);
    await press('a');
    expect(log.slice(2)).toEqual(['list a', 'ancestor a']);
  });
});

describe('the tab stop', () => {
  test('is the active tab, also a disabled one; with no active tab, the first tab', async () => {
    const root = reactive<Record<string, unknown>>({ modelValue: 'a' });
    const { tabStops } = await mountTabs({
      root,
      tabs: [{ key: 'a' }, { key: 'b', attrs: { disabled: true } }, { key: 'c' }],
    });
    expect(tabStops()).toEqual(['a']);
    root.modelValue = 'b';
    await nextTick();
    expect(tabStops()).toEqual(['b']);
    root.modelValue = null;
    await nextTick();
    expect(tabStops()).toEqual(['a']);
    root.modelValue = 'z';
    await nextTick();
    expect(tabStops()).toEqual(['a']);
  });

  test('moves with a value from the parent while no tab has the focus, and stays on the focused tab', async () => {
    const root = reactive<Record<string, unknown>>({ modelValue: 'a' });
    const { tab, tabStops, selected, focused } = await mountTabs({
      root,
      tabs: items('a', 'b', 'c'),
    });
    root.modelValue = 'c';
    await nextTick();
    expect(tabStops()).toEqual(['c']);
    tab('a').focus();
    await nextTick();
    root.modelValue = 'b';
    await nextTick();
    expect(tabStops()).toEqual(['a']);
    expect(selected()).toEqual(['b']);
    await press('{ArrowRight}');
    expect(focused()).toBe('b');
    expect(tabStops()).toEqual(['b']);
  });

  test('goes to the active tab when the focused tab unmounts, in each browser', async () => {
    const tabs = reactive<Item[]>(items('a', 'b', 'c'));
    const { tab, tabStops } = await mountTabs({ root: { defaultValue: 'a' }, tabs });
    tab('a').focus();
    await press('{ArrowRight}');
    expect(tabStops()).toEqual(['b']);
    tabs.splice(1, 1);
    await settle();
    expect(tabStops()).toEqual(['a']);
  });

  test('with no active tab, is the first tab in the document, also a tab that mounts before the others', async () => {
    const tabs = reactive<Item[]>(items('b', 'c'));
    const { tabStops } = await mountTabs({ root: { modelValue: null }, tabs });
    expect(tabStops()).toEqual(['b']);
    tabs.unshift({ key: 'a' });
    await nextTick();
    expect(tabStops()).toEqual(['a']);
  });

  test('keeps the first tab when the active tab and the first tab unmount one after the other', async () => {
    const tabs = reactive<Item[]>(items('a', 'b', 'c', 'd'));
    const { tabStops } = await mountTabs({ root: { modelValue: 'b' }, tabs });
    tabs.splice(1, 1);
    await nextTick();
    expect(tabStops()).toEqual(['a']);
    tabs.splice(0, 1);
    await nextTick();
    expect(tabStops()).toEqual(['c']);
  });

  test('Tab enters the list on the active tab after the focus leaves it, with manual activation', async () => {
    const { root, tab, panel } = await mountTabs({
      root: { defaultValue: 'b' },
      tabs: items('a', 'b', 'c'),
    });
    tab('b').focus();
    await press('{ArrowRight}');
    expect(document.activeElement).toBe(tab('c'));
    root.querySelector<HTMLElement>('#after')!.focus();
    await press('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(panel('b'));
    await press('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(tab('b'));
  });

  test('a tab in a Teleport takes part in the keys and in the tab stop', async () => {
    const { root } = mount(TabsElements, {
      root: { defaultValue: 'teleported' },
      teleported: true,
    });
    await nextTick();
    const teleported = screen.getByRole('tab', { name: 'Teleported' });
    expect(root.contains(teleported)).toBe(false);
    expect(teleported.tabIndex).toBe(0);
    expect(screen.getByRole('tab', { name: 'Button' }).tabIndex).toBe(-1);
    teleported.focus();
    await press('{ArrowRight}');
    expect(document.activeElement).toHaveTextContent('Link');
    await press('{ArrowLeft}');
    expect(document.activeElement).toBe(teleported);
  });
});

describe('the scroll at the mount', () => {
  async function mountScrolled(orientation: string, style: string, tabStyle = '', dir = '') {
    const before = window.scrollY;
    const { list, tab } = await mountTabs({
      root: { defaultValue: 'h', orientation },
      list: { style: `margin-top: 200vh; ${style}` },
      tabs: 'abcdefghij'.split('').map((key) => ({ key, attrs: { style: tabStyle } })),
      dir,
    });
    const listRect = list.getBoundingClientRect();
    const tabRect = tab('h').getBoundingClientRect();
    return { list, tabRect, listRect, pageScrolled: window.scrollY !== before };
  }

  test('a list that overflows shows its active tab, with the scroll-padding of the list and the scroll-margin of the tab; the page does not scroll', async () => {
    const { list, listRect, tabRect, pageScrolled } = await mountScrolled(
      'horizontal',
      'display: flex; width: 120px; overflow: auto; border: 4px solid; scroll-padding-right: 5px',
      'flex: none; width: 60px; scroll-margin-right: 6px',
    );
    expect(list.scrollLeft).toBeGreaterThan(0);
    expect(tabRect.right).toBeCloseTo(listRect.left + list.clientLeft + list.clientWidth - 11, 0);
    expect(pageScrolled).toBe(false);
  });

  test('a right-to-left list scrolls to the left, with the scroll-padding and the scroll-margin of that side', async () => {
    const { list, listRect, tabRect } = await mountScrolled(
      'horizontal',
      'display: flex; width: 120px; overflow: auto; border: 4px solid; scroll-padding-left: 5px',
      'flex: none; width: 60px; scroll-margin-left: 3px',
      'rtl',
    );
    expect(list.scrollLeft).toBeLessThan(0);
    expect(tabRect.left).toBeCloseTo(listRect.left + list.clientLeft + 8, 0);
  });

  test('a tab longer than the list shows its start, with the scroll-padding and the scroll-margin of that side', async () => {
    const { list, listRect, tabRect } = await mountScrolled(
      'vertical',
      'display: flex; flex-direction: column; height: 100px; overflow: auto; border: 4px solid; scroll-padding-top: 5px',
      'flex: none; height: 160px; scroll-margin-top: 3px',
    );
    expect(tabRect.top).toBeCloseTo(listRect.top + list.clientTop + 8, 0);
  });

  test('a vertical list reads the scroll-padding and the scroll-margin of its end', async () => {
    const { list, listRect, tabRect } = await mountScrolled(
      'vertical',
      'display: flex; flex-direction: column; height: 100px; overflow: auto; border: 4px solid; scroll-padding-bottom: 10px',
      'flex: none; height: 40px; scroll-margin-bottom: 3px',
    );
    expect(list.scrollTop).toBeGreaterThan(0);
    expect(tabRect.bottom).toBeCloseTo(listRect.top + list.clientTop + list.clientHeight - 13, 0);
  });

  test('a list that gets its first tabs after the mount shows its active tab', async () => {
    const tabs = reactive<Item[]>([]);
    const { list, tab } = await mountTabs({
      root: { defaultValue: 'h' },
      list: { style: 'display: flex; width: 120px; overflow: auto' },
      tabs,
    });
    tabs.push(
      ...'abcdefghij'
        .split('')
        .map((key) => ({ key, attrs: { style: 'flex: none; width: 60px' } })),
    );
    await nextTick();
    expect(list.scrollLeft).toBeGreaterThan(0);
    expect(tab('h').getBoundingClientRect().right).toBeCloseTo(
      list.getBoundingClientRect().left + list.clientLeft + list.clientWidth,
      0,
    );
  });

  test('a list that does not overflow sets nothing', async () => {
    const { list } = await mountScrolled('horizontal', 'display: flex; overflow: auto');
    expect(list.scrollLeft).toBe(0);
  });
});

describe('the names', () => {
  test('VUE-14: a tab names the panel of its value in aria-controls, also with an id of the developer; a panel names its tab in aria-labelledby', async () => {
    const { tab, panel } = await mountTabs({
      root: { defaultValue: 'a' },
      tabs: [{ key: 'a', attrs: { id: 'tab-a' } }, { key: 'b' }],
      panels: [
        { key: 'a', attrs: { id: 'panel-a' } },
        { key: 'b', attrs: { keepMounted: true } },
      ],
    });
    expect(tab('a')).toHaveAttribute('id', 'tab-a');
    expect(tab('a')).toHaveAttribute('aria-controls', 'panel-a');
    expect(panel('a')).toHaveAttribute('aria-labelledby', 'tab-a');
    expect(tab('b').id).toBeTruthy();
    expect(tab('b')).toHaveAttribute('aria-controls', panel('b')!.id);
    expect(panel('b')).toHaveAttribute('aria-labelledby', tab('b').id);
  });

  test('a tab names only a panel in the DOM, and an empty id counts as none', async () => {
    const root = reactive<Record<string, unknown>>({ defaultValue: 'a' });
    const { tab, panel } = await mountTabs({
      root,
      tabs: [{ key: 'a', attrs: { id: ' ' } }, { key: 'b' }],
    });
    expect(tab('a').id).not.toBe(' ');
    expect(panel('a')).toHaveAttribute('aria-labelledby', tab('a').id);
    expect(tab('b')).not.toHaveAttribute('aria-controls');
    await userEvent.click(tab('b'));
    expect(tab('b')).toHaveAttribute('aria-controls', panel('b')!.id);
    expect(tab('a')).not.toHaveAttribute('aria-controls');
  });

  test('a panel names the first tab of its value, and a tab names the last panel of its value', async () => {
    const panels = reactive<Item[]>([
      { key: 'first', value: 'a' },
      { key: 'second', value: 'a' },
    ]);
    const { root, tab } = await mountTabs({
      root: { defaultValue: 'a' },
      tabs: [
        { key: 'one', value: 'a' },
        { key: 'two', value: 'a' },
      ],
      panels,
    });
    const panel = (key: string) => root.querySelector(`[data-key="${key}"][role=tabpanel]`)!;
    expect(panel('second')).toHaveAttribute('aria-labelledby', tab('one').id);
    expect(tab('two')).toHaveAttribute('aria-controls', panel('second').id);
    panels.splice(1, 1);
    await nextTick();
    expect(tab('one')).toHaveAttribute('aria-controls', panel('first').id);
    panels.push({ key: 'third', value: 'a' });
    await nextTick();
    expect(tab('one')).toHaveAttribute('aria-controls', panel('third').id);
  });
  test('a replaced, removed and mounted again panel gives each tab the name of the panel in the DOM', async () => {
    const panels = reactive<Item[]>([{ key: 'one', value: 'a', attrs: { keepMounted: true } }]);
    const { tab, panel } = await mountTabs({
      root: { modelValue: 'a' },
      tabs: items('a', 'b'),
      panels,
    });
    expect(tab('a')).toHaveAttribute('aria-controls', panel('one')!.id);
    expect(tab('b')).not.toHaveAttribute('aria-controls');
    panels.splice(0, 1, { key: 'two', value: 'b', attrs: { keepMounted: true } });
    await nextTick();
    expect(tab('a')).not.toHaveAttribute('aria-controls');
    expect(tab('b')).toHaveAttribute('aria-controls', panel('two')!.id);
    panels.splice(0, 1);
    await nextTick();
    expect(tab('b')).not.toHaveAttribute('aria-controls');
    panels.push({ key: 'three', value: 'b', attrs: { keepMounted: true } });
    await nextTick();
    expect(tab('a')).not.toHaveAttribute('aria-controls');
    expect(tab('b')).toHaveAttribute('aria-controls', panel('three')!.id);
  });
});

describe('the panels', () => {
  test('a closed panel renders nothing; with keepMounted it stays with hidden and inert', async () => {
    const { tab, panel } = await mountTabs({
      root: { defaultValue: 'a' },
      tabs: items('a', 'b'),
      panels: [{ key: 'a', attrs: { keepMounted: true } }, { key: 'b' }],
    });
    expect(panel('b')).toBeNull();
    await userEvent.click(tab('b'));
    expect(panel('a')).toHaveAttribute('hidden');
    expect(panel('a')).toHaveAttribute('inert');
    expect(panel('b')).not.toHaveAttribute('hidden');
  });

  test('<Transition> gives the enter and leave classes; the leave and the enter have the new direction', async () => {
    const log: string[] = [];
    mount(TabsInTransition, { root: { defaultValue: 'a' }, log: recorder(log) });
    await nextTick();
    await userEvent.click(screen.getByRole('tab', { name: 'B' }));
    expect(log).toEqual([
      'leave a right panel-leave-from panel-leave-active',
      'enter b right panel-enter-from panel-enter-active',
    ]);
  });

  test('in a <Transition>, a return to a tab during the leave of its panel renders one panel at each moment; the new panel enters after the old one goes', async () => {
    const root = reactive({ modelValue: 'a' });
    const { root: host } = mount(TabsInTransition, { root });
    await nextTick();
    const panels = () => [...host.querySelectorAll('[role=tabpanel][data-key=a]')];
    const [old] = panels();
    let most = 0;
    const observer = new MutationObserver(() => (most = Math.max(most, panels().length)));
    observer.observe(host, { childList: true, subtree: true });
    root.modelValue = 'b';
    await nextTick();
    root.modelValue = 'a';
    await nextTick();
    expect(panels()).toEqual([old]);
    await waitFor(() => {
      expect(panels()).toHaveLength(1);
      expect(panels()[0]).not.toBe(old);
      expect(panels()[0]!.className).toBe('');
    });
    observer.disconnect();
    expect(most).toBe(1);
  });
});

describe('the activation direction', () => {
  test.each([
    { orientation: 'horizontal', forward: 'right', back: 'left' },
    { orientation: 'vertical', forward: 'down', back: 'up' },
  ])(
    'is the side of the new tab, for a press and for a value of the parent: $orientation',
    async ({ orientation, forward, back }) => {
      const root = reactive<Record<string, unknown>>({ modelValue: 'b', orientation });
      root['onUpdate:modelValue'] = (value: unknown) => (root.modelValue = value);
      const { exposed, tab, panel, list } = await mountTabs({
        root,
        list: {
          style: `display: flex; flex-direction: ${orientation === 'vertical' ? 'column' : 'row'}`,
        },
        tabs: items('a', 'b', 'c'),
        indicator: {},
      });
      const direction = () => exposed.root.element.getAttribute('data-activation-direction');
      expect(direction()).toBe('none');
      await userEvent.click(tab('c'));
      expect(direction()).toBe(forward);
      for (const element of [list, tab('a'), panel('c')!, exposed.indicator.element]) {
        expect(element).toHaveAttribute('data-activation-direction', forward);
      }
      root.modelValue = 'a';
      await nextTick();
      expect(direction()).toBe(back);
      root.modelValue = null;
      await nextTick();
      expect(direction()).toBe('none');
      root.modelValue = 'c';
      await nextTick();
      expect(direction()).toBe('none');
    },
  );

  test('is none after a change of the root, for null, and after a cancelled press; a later change sets it', async () => {
    const tabs = reactive<Item[]>(items('a', 'b', 'c'));
    const root = reactive<Record<string, unknown>>({ defaultValue: 'c' });
    const { exposed, tab } = await mountTabs({ root, tabs });
    const direction = () => exposed.root.element.getAttribute('data-activation-direction');
    await userEvent.click(tab('b'));
    expect(direction()).toBe('left');
    tabs[1]!.attrs = { disabled: true };
    await settle();
    expect(direction()).toBe('none');
    root.onValueChange = (_: unknown, details: TabsRootChangeEventDetails) => details.cancel();
    await userEvent.click(tab('c'));
    expect(direction()).toBe('none');
    root.onValueChange = undefined;
    await userEvent.click(tab('c'));
    expect(direction()).toBe('right');
  });

  test('a value of the parent after a press that the parent ignores or that a listener cancels sets it', async () => {
    for (const cancel of [false, true]) {
      const log: string[] = [];
      const root = rootModel(log, 'a', false);
      if (cancel) {
        root.onValueChange = (_: unknown, details: TabsRootChangeEventDetails) => details.cancel();
      }
      const { exposed, tab } = await mountTabs({
        root,
        list: { style: 'display: flex' },
        tabs: items('a', 'b'),
      });
      const direction = () => exposed.root.element.getAttribute('data-activation-direction');
      await userEvent.click(tab('b'));
      expect(direction()).toBe('none');
      root.modelValue = 'b';
      await nextTick();
      expect(direction()).toBe('right');
    }
  });

  test('the state of a tab in the element slot has the activation direction', async () => {
    // The span stands after the link on its line.
    const root = reactive<Record<string, unknown>>({ modelValue: 'span' });
    const { root: host } = mount(TabsElements, { root });
    await nextTick();
    const link = host.querySelector('a')!;
    expect(link).toHaveAttribute('data-direction', 'none');
    root.modelValue = 'link';
    await nextTick();
    expect(link).toHaveAttribute('data-direction', 'left');
    expect(link).toHaveAttribute('data-activation-direction', 'left');
  });

  test('uses the new orientation when the value and the orientation change together', async () => {
    const root = reactive<Record<string, unknown>>({ modelValue: 'b' });
    const { tab } = await mountTabs({
      root,
      list: { style: 'display: flex' },
      tabs: items('a', 'b'),
    });
    Object.assign(root, { modelValue: 'a', orientation: 'vertical' });
    await nextTick();
    expect(tab('a')).toHaveAttribute('data-activation-direction', 'none');
  });

  test.each([
    { name: 'numbers', values: [2, 1], directions: ['left', 'right'] },
    { name: 'strings out of order', values: ['b', 'a'], directions: ['left', 'right'] },
  ])(
    'with a new tab that mounts in the same update, comes from the values, then from the elements: $name',
    async ({ values: [first, second], directions }) => {
      const tabs = reactive<Item[]>([{ key: 'first', value: first }]);
      const root = reactive<Record<string, unknown>>({ modelValue: first });
      const { exposed } = await mountTabs({ root, list: { style: 'display: flex' }, tabs });
      const element = exposed.root.element as HTMLElement;
      const records: MutationRecord[] = [];
      const observer = new MutationObserver((list) => records.push(...list));
      observer.observe(element, {
        attributeFilter: ['data-activation-direction'],
        attributeOldValue: true,
      });
      tabs.push({ key: 'second', value: second });
      root.modelValue = second;
      await settle();
      records.push(...observer.takeRecords());
      observer.disconnect();
      const seen = [
        ...records.slice(1).map((record) => record.oldValue),
        element.getAttribute('data-activation-direction'),
      ];
      expect(seen).toEqual(directions);
    },
  );
});

describe('other families', () => {
  test('keeps a nested root independent from the one hosting its panel', async () => {
    const { tab, panel } = await (async () => {
      const { root } = mount(TabsParts, {
        root: { defaultValue: 'outer' },
        tabs: items('outer', 'other'),
        nested: true,
      });
      await nextTick();
      return {
        tab: (key: string) => root.querySelector<HTMLElement>(`[role=tab][data-key="${key}"]`)!,
        panel: (key: string) =>
          root.querySelector<HTMLElement>(`[role=tabpanel][data-key="${key}"]`),
      };
    })();
    expect(tab('outer')).toHaveAttribute('aria-controls', panel('outer')!.id);
    expect(tab('x')).toHaveAttribute('aria-controls', panel('x')!.id);
    expect(panel('x')).toHaveAttribute('aria-labelledby', tab('x').id);
    tab('x').focus();
    await press('{ArrowRight}');
    expect(document.activeElement).toBe(tab('y'));
    expect(tab('y')).toHaveAttribute('aria-selected', 'false');
    await press('{Enter}');
    expect(tab('y')).toHaveAttribute('aria-selected', 'true');
    expect(panel('y')).not.toHaveAttribute('hidden');
    expect(tab('outer')).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(tab('other'));
    expect(tab('x')).toBeNull();
    expect(panel('other')).not.toHaveAttribute('hidden');
  });

  test.each(['popover', 'dialog'] as const)('works inside a %s', async (host) => {
    mount(TabsInPopups, { host });
    await nextTick();
    await waitForLaterMillisecond(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Open' }));
      await waitFor(() => expect(screen.getByRole('tab', { name: 'Overview' })).toHaveFocus());
    });
    await press('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Projects' })).toHaveFocus();
  });

  test('VUE-87: a toolbar item in a panel and beside the panels stays an item of the toolbar', async () => {
    mount(TabsInPopups, { host: 'toolbar' });
    await nextTick();
    screen.getByRole('button', { name: 'In a panel' }).focus();
    await press('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'In the root' })).toHaveFocus();
    await press('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'After the root' })).toHaveFocus();
  });
});

describe('a tab that is not a button', () => {
  test('a link and a span activate with Enter and Space; a link navigates', async () => {
    const { root } = mount(TabsElements, { root: { defaultValue: 'button' } });
    await nextTick();
    const link = root.querySelector('a')!;
    const span = root.querySelector<HTMLElement>('span[role=tab]')!;
    const navigations: string[] = [];
    root.addEventListener('click', (event) => {
      navigations.push((event.target as Element).localName);
      event.preventDefault();
    });
    // Space does not scroll the page.
    const spaces: boolean[] = [];
    root.addEventListener('keydown', (event) => {
      if (event.key === ' ') spaces.push(event.defaultPrevented);
    });
    span.focus();
    await press('{Enter}');
    expect(span).toHaveAttribute('aria-selected', 'true');
    link.focus();
    await press(' ');
    expect(link).toHaveAttribute('aria-selected', 'true');
    span.focus();
    await press(' ');
    link.focus();
    await press('{Enter}');
    expect(navigations).toEqual(['span', 'a', 'span', 'a']);
    expect(spaces).toEqual([true, true]);
    expect(link).toHaveAttribute('aria-selected', 'true');
  });

  test('Enter on a link tab gives the click the modifier keys, as on a native link', async () => {
    const { root } = mount(TabsElements, { root: { defaultValue: 'button' } });
    await nextTick();
    const link = root.querySelector('a')!;
    const shiftKeys: boolean[] = [];
    root.addEventListener('click', (event) => {
      shiftKeys.push(event.shiftKey);
      event.preventDefault();
    });
    link.focus();
    await press('{Shift>}{Enter}{/Shift}');
    expect(shiftKeys).toEqual([true]);
    expect(link).toHaveAttribute('aria-selected', 'true');
  });

  test('a disabled link tab does not navigate', async () => {
    const { root } = mount(TabsElements, {
      root: { defaultValue: 'button' },
      link: { disabled: true },
    });
    await nextTick();
    const hash = location.hash;
    await userEvent.click(root.querySelector('a')!, { force: true });
    root.querySelector('a')!.focus();
    await press('{Enter}');
    expect(location.hash).toBe(hash);
    expect(root.querySelector('a')).toHaveAttribute('aria-selected', 'false');
  });

  test('a button in a disabled fieldset is disabled by the browser and keeps the active tab', async () => {
    const { root } = mount(TabsElements, { root: { defaultValue: 'fieldset' } });
    await nextTick();
    const inFieldset = screen.getByRole('tab', { name: 'In a fieldset' });
    expect(inFieldset.matches(':disabled')).toBe(true);
    expect(inFieldset).toHaveAttribute('aria-selected', 'true');
    expect(root.querySelector('[role=tab]:not(:disabled)[aria-selected=true]')).toBeNull();
  });
});

// The cases throw in `setup`, so they are the last of the file.
describe('the errors', () => {
  test.each([
    {
      part: 'list',
      message:
        'Vase UI: A part of Tabs must be inside <Tabs.Root>. Without a root the part has no value and no orientation. Put the part inside <Tabs.Root>.',
    },
    {
      part: 'panel',
      message:
        'Vase UI: A part of Tabs must be inside <Tabs.Root>. Without a root the part has no value and no orientation. Put the part inside <Tabs.Root>.',
    },
    {
      part: 'tab',
      message:
        'Vase UI: A tab or an indicator of Tabs must be inside <Tabs.List>. Without a list the part has no list element to read and no keyboard navigation. Put the part inside <Tabs.List>.',
    },
    {
      part: 'indicator',
      message:
        'Vase UI: A tab or an indicator of Tabs must be inside <Tabs.List>. Without a list the part has no list element to read and no keyboard navigation. Put the part inside <Tabs.List>.',
    },
  ])('a $part outside its parent throws an error that says so', ({ part, message }) => {
    expect((mountError(TabsPartOutside, { part }) as Error).message).toBe(message);
    // After the error, Vapor renders the part with no setup, and warns about each binding.
    takeReportedMessages();
  });
});
