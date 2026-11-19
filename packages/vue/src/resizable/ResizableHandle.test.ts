import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { ResizableLayout, ResizableRootChangeEventDetails } from '@vase-ui/vue/resizable';
import ResizableElements from '../../test/fixtures/ResizableElements.vue';
import ResizableLayoutFixture from '../../test/fixtures/ResizableLayout.vue';
import { expectNoAxeViolations } from '../../test/axe';
import { mount, settle } from '../../test/render';
import {
  byKey,
  doubleClick,
  drag,
  frames,
  grows,
  key,
  moveTo,
  press,
  release,
  widthOf,
  type LayoutPart,
  type LayoutSpec,
} from '../../test/resizable';

interface Options {
  root?: Record<string, unknown>;
  panels?: Record<string, unknown>[];
  handle?: Record<string, unknown>;
}

// The frame is 400 px wide and 100 px high, and a handle has no size.
async function mountHandles({ root = {}, panels = [{ id: 'a' }, { id: 'b' }], handle }: Options = {}) {
  const parts: LayoutPart[] = panels.flatMap((attrs, index) => [
    ...(index > 0 ? [{ kind: 'handle' as const, key: `h${index}`, ...(handle && { attrs: handle }) }] : []),
    { kind: 'panel' as const, key: `p${index}`, attrs },
  ]);
  const spec = reactive<LayoutSpec>({ root, parts });
  const { root: container } = mount(ResizableLayoutFixture, { spec });
  await settle();
  return {
    container,
    spec,
    at: (key: string) => byKey(container, key),
    flex: (...indexes: number[]) => grows(container, ...indexes.map((index) => `p${index}`)),
  };
}

/** Each event of the root, with its reason and the type of its native event. */
function logged(log: unknown[][]) {
  return {
    onLayoutChange: (layout: ResizableLayout, details: ResizableRootChangeEventDetails) =>
      log.push(['layoutChange', layout, details.reason, details.event.type]),
    onLayoutCommitted: (layout: ResizableLayout, details: { reason: string; event: Event }) =>
      log.push(['layoutCommitted', layout, details.reason, details.event.type]),
  };
}

/** Whether the default action of the next key on the element is prevented. */
function recordKeys(element: HTMLElement) {
  const prevented: boolean[] = [];
  element.addEventListener('keydown', (event) => queueMicrotask(() => prevented.push(event.defaultPrevented)));
  return prevented;
}

const ends = (handle: HTMLElement) =>
  ['data-at-min', 'data-at-max'].filter((name) => handle.hasAttribute(name));

describe('attributes', () => {
  test.each([
    { name: 'horizontal', orientation: 'horizontal', expected: 'vertical' },
    { name: 'vertical', orientation: 'vertical', expected: 'horizontal' },
  ] as const)('a focusable separator across the axis of a $name root', async ({ orientation, expected }) => {
    const { at } = await mountHandles({ root: { orientation } });
    const handle = at('h1');
    expect(handle.tagName).toBe('DIV');
    expect(handle).toHaveAttribute('role', 'separator');
    expect(handle).toHaveAttribute('tabindex', '0');
    expect(handle).toHaveAttribute('aria-orientation', expected);
    expect(handle).not.toHaveAttribute('data-orientation');
    expect(handle).not.toHaveAttribute('data-disabled');
    expect(handle.style.touchAction).toBe('none');
    expect(handle.style.position).toBe('relative');
    expect(handle.style.cursor).toBe('');
  });

  test('the value of the panel before it, with the least and the greatest value; primaryPanel="next" gives the panel after it', async () => {
    const panels = [
      { id: 'a', minSize: 10 },
      { id: 'b', minSize: 20 },
      { id: 'c', minSize: 10 },
    ];
    const root = { defaultLayout: { a: 40, b: 30, c: 30 } };
    const previous = await mountHandles({ root, panels });
    const values = (handle: HTMLElement) =>
      ['aria-valuenow', 'aria-valuemin', 'aria-valuemax', 'aria-controls'].map((name) =>
        handle.getAttribute(name),
      );
    expect(values(previous.at('h1'))).toEqual(['40', '10', '70', 'a']);
    expect(values(previous.at('h2'))).toEqual(['30', '20', '50', 'b']);
    const next = await mountHandles({ root, panels, handle: { primaryPanel: 'next' } });
    expect(values(next.at('h1'))).toEqual(['30', '20', '60', 'b']);
    expect(values(next.at('h2'))).toEqual(['30', '10', '70', 'c']);
  });

  test('the values are whole numbers, and follow a key and a drag', async () => {
    const thirds = await mountHandles({
      panels: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      root: { defaultLayout: { a: 33.4, b: 33.3, c: 33.3 } },
    });
    expect(thirds.at('h1')).toHaveAttribute('aria-valuenow', '33');
    expect(thirds.at('h2')).toHaveAttribute('aria-valuemax', '67');
    const { at } = await mountHandles();
    await drag(at('h1'), 40);
    expect(at('h1')).toHaveAttribute('aria-valuenow', '60');
    await key(at('h1'), '{ArrowLeft}');
    expect(at('h1')).toHaveAttribute('aria-valuenow', '59');
  });

  test('aria-valuetext and the name of the developer are attributes; axe finds nothing for a named, a disabled and an end handle', async () => {
    const { at, container, spec } = await mountHandles({ handle: { 'aria-valuetext': 'Half' } });
    expect(at('h1')).toHaveAttribute('aria-valuetext', 'Half');
    expect(at('h1')).toHaveAttribute('aria-label', 'Resize h1');
    spec.parts.push({ kind: 'handle', key: 'end' });
    spec.parts.push({ kind: 'panel', key: 'p2', attrs: { id: 'c' } }, { kind: 'handle', key: 'off', attrs: { disabled: true } }, { kind: 'panel', key: 'p3', attrs: { id: 'd' } });
    spec.parts.unshift({ kind: 'handle', key: 'first' });
    await settle();
    await expectNoAxeViolations(container);
  });

  test('a handle with no panel on one side has no tab stop, no value, no aria-controls and no aria-disabled, and moves nothing', async () => {
    const log: unknown[][] = [];
    const { at, spec } = await mountHandles({ root: logged(log) });
    spec.parts.unshift({ kind: 'handle', key: 'first' });
    spec.parts.push({ kind: 'handle', key: 'last' });
    await settle();
    for (const key of ['first', 'last']) {
      const handle = at(key);
      expect(handle).toHaveAttribute('role', 'separator');
      for (const name of ['tabindex', 'aria-valuenow', 'aria-controls', 'aria-disabled']) {
        expect(handle).not.toHaveAttribute(name);
      }
      expect(ends(handle)).toEqual(['data-at-min', 'data-at-max']);
    }
    await key(at('first'), '{Home}');
    await drag(at('last'), -40);
    expect(log).toEqual([]);
    expect(at('h1')).toHaveAttribute('aria-valuenow', '50');
  });

  test('a focused handle that loses a panel loses the focus', async () => {
    const { at, spec } = await mountHandles();
    at('h1').focus();
    spec.parts.pop();
    await settle();
    await frames();
    expect(at('h1')).not.toHaveAttribute('tabindex');
    expect(at('h1')).not.toHaveFocus();
  });
});

describe('keys', () => {
  // A key moves the handle on the screen. Page Up and End grow the primary panel.
  test.each([
    { name: 'ArrowRight', orientation: 'horizontal', dir: 'ltr', keys: '{ArrowRight}', size: '51' },
    { name: 'ArrowLeft', orientation: 'horizontal', dir: 'ltr', keys: '{ArrowLeft}', size: '49' },
    { name: 'Shift ArrowRight', orientation: 'horizontal', dir: 'ltr', keys: '{Shift>}{ArrowRight}{/Shift}', size: '60' },
    { name: 'ArrowRight in RTL', orientation: 'horizontal', dir: 'rtl', keys: '{ArrowRight}', size: '49' },
    { name: 'ArrowLeft in RTL', orientation: 'horizontal', dir: 'rtl', keys: '{ArrowLeft}', size: '51' },
    { name: 'ArrowDown', orientation: 'vertical', dir: 'ltr', keys: '{ArrowDown}', size: '51' },
    { name: 'ArrowUp', orientation: 'vertical', dir: 'ltr', keys: '{ArrowUp}', size: '49' },
    { name: 'ArrowDown in RTL', orientation: 'vertical', dir: 'rtl', keys: '{ArrowDown}', size: '51' },
    { name: 'PageUp', orientation: 'horizontal', dir: 'ltr', keys: '{PageUp}', size: '60' },
    { name: 'PageDown', orientation: 'horizontal', dir: 'ltr', keys: '{PageDown}', size: '40' },
    { name: 'PageUp in RTL', orientation: 'horizontal', dir: 'rtl', keys: '{PageUp}', size: '60' },
    { name: 'Home', orientation: 'horizontal', dir: 'ltr', keys: '{Home}', size: '10' },
    { name: 'End', orientation: 'horizontal', dir: 'ltr', keys: '{End}', size: '90' },
  ] as const)('$name', async ({ orientation, dir, keys, size }) => {
    const { at } = await mountHandles({
      root: { orientation, dir },
      panels: [
        { id: 'a', minSize: 10, maxSize: 90 },
        { id: 'b', minSize: 10, maxSize: 90 },
      ],
    });
    await key(at('h1'), keys);
    expect(at('h1')).toHaveAttribute('aria-valuenow', size);
  });

  test('the handle prevents the default of each key that it handles, also at the end of the travel', async () => {
    const { at } = await mountHandles();
    const prevented = recordKeys(at('h1'));
    await key(at('h1'), '{ArrowRight}{End}{End}');
    expect(prevented).toEqual([true, true, true]);
  });

  test.each([
    { name: 'ArrowUp in a horizontal root', orientation: 'horizontal', keys: '{ArrowUp}' },
    { name: 'ArrowLeft in a vertical root', orientation: 'vertical', keys: '{ArrowLeft}' },
    { name: 'Ctrl with an arrow', orientation: 'horizontal', keys: '{Control>}{ArrowLeft}{/Control}' },
    { name: 'Alt with an arrow', orientation: 'horizontal', keys: '{Alt>}{ArrowLeft}{/Alt}' },
    { name: 'Meta with an arrow', orientation: 'horizontal', keys: '{Meta>}{ArrowLeft}{/Meta}' },
    { name: 'Enter on a panel that is not collapsible', orientation: 'horizontal', keys: '{Enter}' },
  ] as const)('a key of the browser stays: $name', async ({ orientation, keys }) => {
    const log: unknown[][] = [];
    const { at } = await mountHandles({ root: { orientation, ...logged(log) } });
    const prevented = recordKeys(at('h1'));
    await key(at('h1'), keys);
    expect(prevented.at(-1)).toBe(false);
    expect(log).toEqual([]);
  });

  test('the step and the large step of the root; preventDefault() of the developer does not stop the handle', async () => {
    const { at } = await mountHandles({
      root: { step: 2.5, largeStep: 20 },
      handle: { onKeydown: (event: KeyboardEvent) => event.preventDefault() },
    });
    await key(at('h1'), '{ArrowRight}');
    expect(at('h1')).toHaveAttribute('aria-valuenow', '53');
    await key(at('h1'), '{Shift>}{ArrowRight}{/Shift}');
    expect(at('h1')).toHaveAttribute('aria-valuenow', '73');
    await key(at('h1'), '{PageDown}');
    expect(at('h1')).toHaveAttribute('aria-valuenow', '53');
  });

  test('a step in pixels, in em of the root and in rem', async () => {
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    for (const [step, style, expected] of [
      ['20px', undefined, 55],
      ['2em', 'font-size: 10px', 55],
      ['1rem', undefined, 50 + (rem / 400) * 100],
    ] as const) {
      const { at, flex } = await mountHandles({ root: { step, style } });
      await key(at('h1'), '{ArrowRight}');
      expect(Number(flex(0)[0])).toBeCloseTo(expected, 3);
    }
  });

  test('a key during a drag changes nothing; the release commits the drag', async () => {
    const log: unknown[][] = [];
    const { at } = await mountHandles({ root: logged(log) });
    const start = await press(at('h1'));
    await moveTo({ x: start.x + 40, y: start.y });
    const prevented = recordKeys(at('h1'));
    await userEvent.keyboard('{ArrowRight}');
    expect(prevented).toEqual([true]);
    expect(at('h1')).toHaveAttribute('aria-valuenow', '60');
    await release();
    expect(log.map(([name, , reason]) => `${name} ${reason}`)).toEqual(['layoutChange drag', 'layoutCommitted drag']);
  });

  test('primaryPanel="next": Page Up grows the panel after the handle, and an arrow moves the handle on the screen', async () => {
    const { at } = await mountHandles({
      handle: { primaryPanel: 'next' },
      panels: [
        { id: 'a', minSize: 10, maxSize: 90 },
        { id: 'b', minSize: 20, maxSize: 70 },
      ],
    });
    await key(at('h1'), '{PageUp}');
    expect(at('h1')).toHaveAttribute('aria-valuenow', '60');
    await key(at('h1'), '{Home}');
    expect(at('h1')).toHaveAttribute('aria-valuenow', '20');
    await key(at('h1'), '{End}');
    expect(at('h1')).toHaveAttribute('aria-valuenow', '70');
    await key(at('h1'), '{ArrowRight}');
    expect(at('h1')).toHaveAttribute('aria-valuenow', '69');
  });
});

describe('collapse', () => {
  const collapsible = { id: 'a', collapsible: true, minSize: 20, defaultSize: 40 };

  test('Enter collapses the primary panel and gives its size back, with the reason keyboard', async () => {
    const log: unknown[][] = [];
    const { at, flex } = await mountHandles({ root: logged(log), panels: [collapsible, { id: 'b' }] });
    const prevented = recordKeys(at('h1'));
    await key(at('h1'), '{Enter}');
    expect(prevented).toEqual([true]);
    expect(at('h1')).toHaveAttribute('aria-valuenow', '0');
    expect(at('p0')).toHaveAttribute('data-collapsed');
    expect(flex(0, 1)).toEqual(['0', '100']);
    await key(at('h1'), '{Enter}');
    expect(flex(0, 1)).toEqual(['40', '60']);
    expect(log.map(([name, , reason, type]) => `${name} ${reason} ${type}`)).toEqual([
      'layoutChange keyboard keydown',
      'layoutCommitted keyboard keydown',
      'layoutChange keyboard keydown',
      'layoutCommitted keyboard keydown',
    ]);
  });

  test('Enter gives the least size with no size from before; it pushes the next panel only in a root that pushes', async () => {
    const plain = await mountHandles({ panels: [{ ...collapsible, defaultSize: 0 }, { id: 'b' }] });
    await key(plain.at('h1'), '{Enter}');
    expect(plain.flex(0, 1)).toEqual(['20', '80']);
    for (const [pushPanels, sizes] of [
      [true, ['20', '20', '60']],
      [false, ['0', '20', '80']],
    ] as const) {
      const { at, flex } = await mountHandles({
        root: { pushPanels, defaultLayout: { a: 0, b: 20, c: 80 } },
        panels: [{ id: 'a', collapsible: true, minSize: 20 }, { id: 'b', minSize: 20 }, { id: 'c' }],
      });
      await key(at('h1'), '{Enter}');
      expect(flex(0, 1, 2)).toEqual(sizes);
    }
  });

  test('Enter during a drag changes nothing', async () => {
    const { at, flex } = await mountHandles({ panels: [collapsible, { id: 'b' }] });
    const start = await press(at('h1'));
    await moveTo({ x: start.x + 40, y: start.y });
    await userEvent.keyboard('{Enter}');
    expect(flex(0, 1)).toEqual(['50', '50']);
    await release();
  });

  test('primaryPanel="next" collapses the panel after the handle; Home collapses; an arrow collapses and expands at once from the least size', async () => {
    const next = await mountHandles({
      handle: { primaryPanel: 'next' },
      panels: [{ id: 'a' }, { id: 'b', collapsible: true, minSize: 20, defaultSize: 30 }],
    });
    await key(next.at('h1'), '{Enter}');
    expect(next.flex(0, 1)).toEqual(['100', '0']);
    await key(next.at('h1'), '{Enter}');
    expect(next.flex(0, 1)).toEqual(['70', '30']);
    const home = await mountHandles({ panels: [collapsible, { id: 'b' }] });
    expect(home.at('h1')).toHaveAttribute('aria-valuemin', '0');
    await key(home.at('h1'), '{Home}');
    expect(home.flex(0, 1)).toEqual(['0', '100']);
    const arrows = await mountHandles({ panels: [{ ...collapsible, defaultSize: 20 }, { id: 'b' }] });
    await key(arrows.at('h1'), '{ArrowLeft}');
    expect(arrows.flex(0, 1)).toEqual(['0', '100']);
    await key(arrows.at('h1'), '{ArrowRight}');
    expect(arrows.flex(0, 1)).toEqual(['20', '80']);
  });

  test('the second handle collapses the panel before it into the next one, and follows a method of the panel', async () => {
    const { at, flex, container } = await mountHandles({
      root: { defaultLayout: { a: 30, b: 30, c: 40 } },
      panels: [{ id: 'a' }, { id: 'b', collapsible: true, minSize: 20 }, { id: 'c' }],
    });
    await key(at('h2'), '{Enter}');
    expect(flex(0, 1, 2)).toEqual(['30', '0', '70']);
    expect(at('h1')).toHaveAttribute('aria-valuenow', '30');
    expect(at('h2')).toHaveAttribute('aria-valuenow', '0');
    expect(ends(at('h2'))).toEqual(['data-at-min']);
    expect(container).toBeTruthy();
  });
});

describe('double click', () => {
  test.each([
    { name: 'the first size of the panel', root: {}, handle: {}, panels: [{ id: 'a', defaultSize: 30 }, { id: 'b' }], sizes: ['30', '70'] },
    { name: 'the default layout', root: { defaultLayout: { a: 20, b: 80 } }, handle: {}, panels: [{ id: 'a' }, { id: 'b' }], sizes: ['20', '80'] },
    { name: 'the share of a panel with no size', root: {}, handle: {}, panels: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], sizes: ['33.334', '33.333', '33.333'] },
    { name: 'the panel after the handle', root: {}, handle: { primaryPanel: 'next' }, panels: [{ id: 'a' }, { id: 'b', defaultSize: 30 }], sizes: ['70', '30'] },
  ])('gives the primary panel its first size: $name', async ({ root, handle, panels, sizes }) => {
    const log: unknown[][] = [];
    const { at, flex } = await mountHandles({ root: { ...root, ...logged(log) }, handle, panels });
    await drag(at('h1'), 40);
    log.length = 0;
    const event = new MouseEvent('dblclick', { bubbles: true, cancelable: true, detail: 2 });
    at('h1').dispatchEvent(event);
    await nextTick();
    expect(event.defaultPrevented).toBe(true);
    expect(flex(...panels.map((_, index) => index))).toEqual(sizes);
    expect(log.map(([name, , reason, type]) => `${name} ${reason} ${type}`)).toEqual([
      'layoutChange reset dblclick',
      'layoutCommitted reset dblclick',
    ]);
  });

  test('pushes the next panel only in a root that pushes; a second double click and a disabled handle leave the event to the browser', async () => {
    for (const [pushPanels, count] of [
      [true, 2],
      [false, 0],
    ] as const) {
      const log: unknown[][] = [];
      const { at } = await mountHandles({
        root: { pushPanels, modelValue: { a: 30, b: 20, c: 50 }, defaultLayout: { a: 50, b: 20, c: 30 }, ...logged(log) },
        panels: [{ id: 'a' }, { id: 'b', minSize: 20 }, { id: 'c' }],
      });
      await doubleClick(at('h1'));
      expect(log).toHaveLength(count);
    }
    const { at } = await mountHandles({ panels: [{ id: 'a', defaultSize: 30 }, { id: 'b' }] });
    await drag(at('h1'), 40);
    await doubleClick(at('h1'));
    const second = new MouseEvent('dblclick', { bubbles: true, cancelable: true, detail: 2 });
    at('h1').dispatchEvent(second);
    expect(second.defaultPrevented).toBe(false);
    const disabled = await mountHandles({ handle: { disabled: true }, panels: [{ id: 'a', defaultSize: 30 }, { id: 'b' }] });
    const third = new MouseEvent('dblclick', { bubbles: true, cancelable: true, detail: 2 });
    disabled.at('h1').dispatchEvent(third);
    expect(third.defaultPrevented).toBe(false);
  });

  test('gives only the primary panel and the panel beside it their first sizes', async () => {
    const { at, flex } = await mountHandles({
      root: { defaultLayout: { a: 20, b: 30, c: 50 } },
      panels: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    });
    await drag(at('h2'), 40);
    expect(flex(0, 1, 2)).toEqual(['20', '40', '40']);
    await doubleClick(at('h2'));
    expect(flex(0, 1, 2)).toEqual(['20', '30', '50']);
  });
});

describe('ends of the travel', () => {
  const bounded = [
    { id: 'a', minSize: 20, maxSize: 60 },
    { id: 'b', minSize: 30 },
  ];

  test.each([
    { name: 'at the least size', layout: { a: 20, b: 80 }, expected: ['data-at-min'] },
    { name: 'between the ends', layout: { a: 40, b: 60 }, expected: [] },
    { name: 'at the greatest size', layout: { a: 60, b: 40 }, expected: ['data-at-max'] },
  ])('the attribute of the end $name', async ({ layout, expected }) => {
    const { at } = await mountHandles({ root: { defaultLayout: layout }, panels: bounded });
    expect(ends(at('h1'))).toEqual(expected);
  });

  test.each([
    { name: 'the top of a vertical root', root: { orientation: 'vertical' }, handle: {}, expected: ['data-at-min'] },
    { name: 'the right of a right-to-left root', root: { dir: 'rtl' }, handle: {}, expected: ['data-at-max'] },
    { name: 'the panel after the handle', root: {}, handle: { primaryPanel: 'next' }, expected: ['data-at-min'] },
  ])('a side of the screen: $name', async ({ root, handle, expected }) => {
    const { at } = await mountHandles({
      root: { ...root, defaultLayout: { a: 20, b: 80 } },
      handle,
      panels: bounded,
    });
    expect(ends(at('h1'))).toEqual(expected);
  });

  test('a collapsible panel at its least size has neither; collapsed, the least end; a disabled handle neither; a handle that cannot move both', async () => {
    const collapsible = [{ id: 'a', collapsible: true, minSize: 20 }, { id: 'b' }];
    const least = await mountHandles({ root: { defaultLayout: { a: 20, b: 80 } }, panels: collapsible });
    expect(ends(least.at('h1'))).toEqual([]);
    const collapsed = await mountHandles({ root: { defaultLayout: { a: 0, b: 100 } }, panels: collapsible });
    expect(ends(collapsed.at('h1'))).toEqual(['data-at-min']);
    const disabled = await mountHandles({ root: { defaultLayout: { a: 20, b: 80 } }, handle: { disabled: true }, panels: bounded });
    expect(ends(disabled.at('h1'))).toEqual([]);
    const locked = await mountHandles({ panels: [{ id: 'a', disabled: true }, { id: 'b' }] });
    expect(ends(locked.at('h1'))).toEqual(['data-at-min', 'data-at-max']);
  });

  test('the state follows a drag; a root that does not push counts only the next panel', async () => {
    const { at } = await mountHandles({ panels: bounded });
    const state = () => JSON.parse(at('h1').querySelector('.handle-state')!.textContent!);
    expect(state()).toEqual(expect.objectContaining({ atMin: false, atMax: false }));
    await drag(at('h1'), -160);
    expect(ends(at('h1'))).toEqual(['data-at-min']);
    expect(state()).toEqual(expect.objectContaining({ atMin: true, atMax: false }));
    await drag(at('h1'), 200);
    expect(ends(at('h1'))).toEqual(['data-at-max']);
    const notPushing = await mountHandles({
      root: { pushPanels: false, defaultLayout: { a: 30, b: 30, c: 40 } },
      panels: [{ id: 'a' }, { id: 'b', minSize: 30 }, { id: 'c' }],
    });
    expect(ends(notPushing.at('h1'))).toEqual(['data-at-max']);
  });
});

describe('prop: disabled', () => {
  test('aria-disabled, no tab stop and no value; a drag, a key and a double click do nothing; the root disables it too', async () => {
    for (const options of [{ handle: { disabled: true } }, { root: { disabled: true } }]) {
      const log: unknown[][] = [];
      const { at } = await mountHandles({ ...options, root: { ...options.root, ...logged(log) } });
      const handle = at('h1');
      expect(handle).toHaveAttribute('aria-disabled', 'true');
      expect(handle).not.toHaveAttribute('tabindex');
      expect(handle).not.toHaveAttribute('aria-valuenow');
      expect(handle).toHaveAttribute('aria-controls', 'a');
      expect(JSON.parse(handle.querySelector('.handle-state')!.textContent!).disabled).toBe(true);
      await drag(handle, 40);
      // A disabled handle takes no focus, so the key comes from a script.
      handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await doubleClick(handle);
      expect(log).toEqual([]);
    }
  });

  test('a focused handle that becomes disabled loses the focus, and its drag ends', async () => {
    const log: unknown[][] = [];
    const { at, spec } = await mountHandles({ root: logged(log) });
    const start = await press(at('h1'));
    await moveTo({ x: start.x + 40, y: start.y });
    expect(at('h1')).toHaveFocus();
    spec.parts[1]!.attrs = { disabled: true };
    await nextTick();
    await frames();
    expect(at('h1')).not.toHaveAttribute('data-dragging');
    expect(at('h1')).not.toHaveFocus();
    await release();
    expect(log.map(([name]) => name)).toEqual(['layoutChange', 'layoutCommitted']);
  });
});

describe('the pointer target', () => {
  test('one empty span after the content of the developer, 10 px on the axis of the move at the least, the full size on the other axis', async () => {
    for (const orientation of ['horizontal', 'vertical'] as const) {
      const { at } = await mountHandles({
        root: { orientation },
        handle: { style: orientation === 'horizontal' ? 'flex: none; width: 2px' : 'flex: none; height: 2px' },
      });
      const handle = at('h1');
      const target = handle.lastElementChild as HTMLElement;
      expect(handle.children).toHaveLength(2);
      expect(target.tagName).toBe('SPAN');
      expect(target.getAttributeNames()).toEqual(['style']);
      expect(target).toBeEmptyDOMElement();
      const box = handle.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      expect(
        orientation === 'horizontal'
          ? [rect.width, rect.left, rect.height]
          : [rect.height, rect.top, rect.width],
      ).toEqual(
        orientation === 'horizontal' ? [10, box.left - 4, box.height] : [10, box.top - 4, box.width],
      );
    }
  });

  test('--resizable-handle-hit-area-size gives another size; a wider handle keeps its box', async () => {
    const wide = await mountHandles({ root: { style: '--resizable-handle-hit-area-size: 24px' } });
    expect(widthOf(wide.at('h1').lastElementChild!)).toBe(24);
    const none = await mountHandles({ handle: { style: '--resizable-handle-hit-area-size: 0px; width: 3px; flex: none' } });
    expect(widthOf(none.at('h1').lastElementChild!)).toBe(3);
    const box = await mountHandles({ handle: { style: 'flex: none; width: 20px' } });
    expect(widthOf(box.at('h1').lastElementChild!)).toBe(20);
  });

  test('position: relative; the style of the developer wins', async () => {
    const { at } = await mountHandles({ handle: { style: { position: 'absolute' } } });
    expect(at('h1').style.position).toBe('absolute');
  });

  test('a handle that cannot move takes no press beside it; a handle with a disabled panel on one side does', async () => {
    const disabled = await mountHandles({ handle: { disabled: true } });
    expect((disabled.at('h1').lastElementChild as HTMLElement).style.pointerEvents).toBe('none');
    const locked = await mountHandles({ panels: [{ id: 'a', disabled: true }, { id: 'b' }] });
    expect((locked.at('h1').lastElementChild as HTMLElement).style.pointerEvents).toBe('');
    disabled.spec.parts[1]!.attrs = {};
    await nextTick();
    expect((disabled.at('h1').lastElementChild as HTMLElement).style.pointerEvents).toBe('');
  });

  test('a click reaches a button 3 px beside a disabled handle', async () => {
    const clicks: string[] = [];
    const { at } = await mountHandles({
      handle: { disabled: true, style: 'flex: none; width: 1px' },
      panels: [{ id: 'a' }, { id: 'b', style: 'display: flex' }],
    });
    const button = at('p1').insertBefore(document.createElement('button'), at('p1').firstChild);
    button.style.cssText = 'width: 20px; height: 20px; margin: 0; padding: 0';
    button.addEventListener('click', () => clicks.push('button'));
    const box = at('h1').getBoundingClientRect();
    await userEvent.pointer({ coords: { x: box.right + 3, y: button.getBoundingClientRect().top + 5 }, keys: '[MouseLeft]' });
    expect(clicks).toEqual(['button']);
  });
});

describe('the element slot and the state', () => {
  test('the element slot renders a component that exposes its element; the state of the handle reaches the slot', async () => {
    const { root } = mount(ResizableElements, {});
    await settle();
    const main = root.querySelector('main')!;
    expect(main.style.display).toBe('flex');
    expect(JSON.parse(main.dataset.state!)).toEqual({
      orientation: 'horizontal',
      disabled: false,
      dragging: false,
    });
    const handle = root.querySelector<HTMLElement>('span[role="separator"]')!;
    expect(handle).toHaveAttribute('aria-controls', 'first');
    expect(handle).toHaveAttribute('aria-valuenow', '30');
    expect(handle.children).toHaveLength(0);
    expect(JSON.parse(handle.dataset.state!)).toEqual({
      orientation: 'horizontal',
      disabled: false,
      dragging: false,
      crossing: false,
      // The first panel is disabled, so the handle cannot move.
      atMin: true,
      atMax: true,
    });
    expect(handle).toHaveAttribute('tabindex', '0');
  });
});
