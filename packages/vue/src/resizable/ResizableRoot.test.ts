import { describe, expect, onTestFinished, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { ResizableLayout, ResizableRootChangeEventDetails } from '@vase-ui/vue/resizable';
import ResizableLayoutFixture from '../../test/fixtures/ResizableLayout.vue';
import ResizableKeptAlive from '../../test/fixtures/ResizableKeptAlive.vue';
import ResizableSwap from '../../test/fixtures/ResizableSwap.vue';
import { takeReportedMessages } from '../../test/reportedMessages';
import { mount, mountError, settle } from '../../test/render';
import {
  byKey,
  doubleClick,
  drag,
  grows,
  key,
  panelsAndHandles,
  part,
  press,
  release,
  moveTo,
  widthOf,
  type LayoutSpec,
} from '../../test/resizable';
import ResizableOutsideRoot from '../../test/fixtures/ResizableOutsideRoot.vue';

async function mountLayout(spec: LayoutSpec, frame?: string) {
  const layout = reactive(spec);
  const { root, exposed } = mount(ResizableLayoutFixture, {
    spec: layout,
    ...(frame && { frame }),
  });
  await settle();
  return { root, spec: layout, exposed, at: (key: string) => byKey(root, key) };
}

const three = () => panelsAndHandles('a', 'b', 'c');

/** Root props that write each event in `log`. With `write`, the parent writes `v-model`. */
function logged(log: unknown[][], model?: { value: ResizableLayout | null | undefined }) {
  return {
    ...(model && { modelValue: model.value }),
    onLayoutChange: (layout: ResizableLayout, details: ResizableRootChangeEventDetails) =>
      log.push(['layoutChange', layout, details.reason, details.event.type]),
    'onUpdate:modelValue': (layout: ResizableLayout) => log.push(['update', layout]),
    onLayoutCommitted: (layout: ResizableLayout, details: { reason: string; event: Event }) =>
      log.push(['layoutCommitted', layout, details.reason, details.event.type]),
    onDraggingChange: (dragging: boolean) => log.push(['draggingChange', dragging]),
  };
}

describe('the root', () => {
  test.each([
    { name: 'horizontal', orientation: 'horizontal', direction: 'row' },
    { name: 'vertical', orientation: 'vertical', direction: 'column' },
  ] as const)(
    'is a div with display: flex and data-orientation, $name',
    async ({ orientation, direction }) => {
      const { at } = await mountLayout({ root: { orientation }, parts: three() });
      const root = at('root');
      expect(root.tagName).toBe('DIV');
      expect(root.style.display).toBe('flex');
      expect(root.style.flexDirection).toBe(direction);
      expect(root).toHaveAttribute('data-orientation', orientation);
      expect(root).not.toHaveAttribute('role');
    },
  );

  test('the style and the class of the developer merge, and the value of the developer wins', async () => {
    const onKeydown = vi.fn();
    const { at } = await mountLayout({
      root: { class: 'Root', style: { display: 'grid', color: 'red' }, onKeydown },
      parts: three(),
    });
    const root = at('root');
    expect(root).toHaveClass('Root');
    expect(root.style.display).toBe('grid');
    expect(root.style.flexDirection).toBe('row');
    expect(root.style.color).toBe('red');
    await key(at('h1'), '{ArrowRight}');
    expect(onKeydown).toHaveBeenCalledTimes(1);
  });

  test('data-disabled and data-dragging; the default slot gets the state and the sizes', async () => {
    const { root, spec, at } = await mountLayout({ root: { defaultLayout: { a: 20 } }, parts: three() });
    const slot = () => JSON.parse(root.querySelector('.root-state')!.textContent!);
    expect(slot()).toEqual({
      state: { orientation: 'horizontal', disabled: false, dragging: false },
      sizes: { a: 20, b: 40, c: 40 },
    });
    await press(at('h1'));
    expect(at('root')).toHaveAttribute('data-dragging');
    expect(slot().state.dragging).toBe(true);
    await release();
    expect(at('root')).not.toHaveAttribute('data-dragging');
    spec.root!.disabled = true;
    await nextTick();
    expect(at('root')).toHaveAttribute('data-disabled');
    expect(slot().state.disabled).toBe(true);
  });

  test('a template ref has element', async () => {
    const { exposed, at } = await mountLayout({ parts: three() });
    expect((exposed.panels.a as { element: HTMLElement }).element).toBe(at('a'));
  });
});

describe('prop: defaultLayout', () => {
  test.each([
    { name: 'an entry for each panel', layout: { a: 20, b: 30, c: 50 }, sizes: ['20', '30', '50'] },
    { name: 'a lacking panel', layout: { a: 50 }, sizes: ['50', '25', '25'] },
    { name: 'an entry with no panel', layout: { a: 30, b: 30, c: 30, gone: 10 }, sizes: ['33.334', '33.333', '33.333'] },
    { name: 'strings in percent', layout: { a: '20', b: '30%' }, sizes: ['20', '30', '50'] },
  ])('gives each panel its size: $name', async ({ layout, sizes }) => {
    const { root } = await mountLayout({ root: { defaultLayout: layout }, parts: three() });
    expect(grows(root, 'a', 'b', 'c')).toEqual(sizes);
  });

  test('an entry that is not a size gives the share that is left, with a warning', async () => {
    const { root } = await mountLayout({
      root: { defaultLayout: { a: '1fr', b: 30 } },
      parts: three(),
    });
    expect(grows(root, 'a', 'b', 'c')).toEqual(['35', '30', '35']);
    expect(takeReportedMessages()).toEqual([
      'console.warn: Vase UI: The layout gives the panel "a" the size "1fr", which is not valid. The root ignores this size, so the panel takes its `defaultSize`, or an equal share of the space that is left. Use a number of 0 or more, or a string of such a number with an optional unit: "%", "px", "em", "rem", "vh" or "vw".',
    ]);
  });

  test('a later change has no effect', async () => {
    const { root, spec } = await mountLayout({ root: { defaultLayout: { a: 20 } }, parts: three() });
    spec.root!.defaultLayout = { a: 60 };
    await nextTick();
    expect(grows(root, 'a')).toEqual(['20']);
  });
});

describe('prop: modelValue', () => {
  test('a controlled root shows a drag only after the parent writes the layout', async () => {
    const log: unknown[][] = [];
    const { root, spec, at } = await mountLayout({
      root: { ...logged(log), modelValue: { a: 30, b: 30, c: 40 } },
      parts: three(),
    });
    await drag(at('h1'), 40);
    expect(log).toContainEqual(['update', { a: 40, b: 20, c: 40 }]);
    expect(grows(root, 'a', 'b', 'c')).toEqual(['30', '30', '40']);
    spec.root!.modelValue = { a: 40, b: 20, c: 40 };
    await nextTick();
    expect(grows(root, 'a', 'b', 'c')).toEqual(['40', '20', '40']);
  });

  test('v-model follows each change; {} gives each panel its first size again', async () => {
    const { root, spec, at } = await mountLayout({ root: { modelValue: {} }, parts: three() });
    spec.root!['onUpdate:modelValue'] = (layout: ResizableLayout) => {
      spec.root!.modelValue = layout;
    };
    await drag(at('h1'), 40);
    expect(spec.root!.modelValue).toEqual({ a: 43.334, b: 23.333, c: 33.333 });
    expect(grows(root, 'a', 'b', 'c')).toEqual(['43.334', '23.333', '33.333']);
    spec.root!.modelValue = {};
    await nextTick();
    expect(grows(root, 'a', 'b', 'c')).toEqual(['33.334', '33.333', '33.333']);
  });

  test('null is a layout with no entries, and the root stays controlled; undefined makes it uncontrolled', async () => {
    const { root, spec, at } = await mountLayout({
      root: { modelValue: { a: 20, b: 30, c: 50 }, defaultLayout: { a: 50, b: 25, c: 25 } },
      parts: three(),
    });
    spec.root!.modelValue = null;
    await nextTick();
    expect(grows(root, 'a', 'b', 'c')).toEqual(['33.334', '33.333', '33.333']);
    await drag(at('h1'), 40);
    expect(grows(root, 'a', 'b', 'c')).toEqual(['33.334', '33.333', '33.333']);
    spec.root!.modelValue = undefined;
    await nextTick();
    await drag(at('h1'), 40);
    expect(grows(root, 'a', 'b', 'c')).toEqual(['43.334', '23.333', '33.333']);
  });

  test('a new object with the same entries changes nothing', async () => {
    const log: unknown[][] = [];
    const { spec, root } = await mountLayout({
      root: { ...logged(log), modelValue: { a: 20, b: 30, c: 50 } },
      parts: three(),
    });
    spec.root!.modelValue = { a: 20, b: 30, c: 50 };
    await nextTick();
    expect(grows(root, 'a', 'b', 'c')).toEqual(['20', '30', '50']);
    expect(log).toEqual([]);
  });
});

describe('change events', () => {
  test('a drag gives layoutChange, then update:modelValue, for each move, and one layoutCommitted at the release', async () => {
    const log: unknown[][] = [];
    const { at } = await mountLayout({ root: logged(log), parts: three() });
    const start = await press(at('h1'));
    await moveTo({ x: start.x + 20, y: start.y });
    await moveTo({ x: start.x + 40, y: start.y });
    await release();
    expect(log).toEqual([
      ['draggingChange', true],
      ['layoutChange', { a: 38.334, b: 28.333, c: 33.333 }, 'drag', 'pointermove'],
      ['update', { a: 38.334, b: 28.333, c: 33.333 }],
      ['layoutChange', { a: 43.334, b: 23.333, c: 33.333 }, 'drag', 'pointermove'],
      ['update', { a: 43.334, b: 23.333, c: 33.333 }],
      ['draggingChange', false],
      ['layoutCommitted', { a: 43.334, b: 23.333, c: 33.333 }, 'drag', 'pointerup'],
    ]);
  });

  test('a key gives layoutChange, update:modelValue and layoutCommitted with the reason keyboard', async () => {
    const log: unknown[][] = [];
    const { at } = await mountLayout({ root: { ...logged(log), defaultLayout: { a: 30, b: 30 } }, parts: three() });
    await key(at('h1'), '{ArrowRight}');
    expect(log).toEqual([
      ['layoutChange', { a: 31, b: 29, c: 40 }, 'keyboard', 'keydown'],
      ['update', { a: 31, b: 29, c: 40 }],
      ['layoutCommitted', { a: 31, b: 29, c: 40 }, 'keyboard', 'keydown'],
    ]);
  });

  test('the layout of each event is a new object', async () => {
    const layouts: ResizableLayout[] = [];
    const { at } = await mountLayout({
      root: {
        onLayoutChange: (layout: ResizableLayout) => layouts.push(layout),
        'onUpdate:modelValue': (layout: ResizableLayout) => layouts.push(layout),
      },
      parts: three(),
    });
    await key(at('h1'), '{ArrowRight}');
    await key(at('h1'), '{ArrowRight}');
    expect(layouts[0]).toBe(layouts[1]);
    expect(layouts[2]).not.toBe(layouts[0]);
  });

  test.each([
    { name: 'a drag', act: (at: (key: string) => HTMLElement) => drag(at('h1'), 40) },
    { name: 'a key', act: (at: (key: string) => HTMLElement) => key(at('h1'), '{ArrowRight}') },
    { name: 'a double click', act: (at: (key: string) => HTMLElement) => doubleClick(at('h1')) },
  ])('details.cancel() keeps the layout, with no update and no commit: $name', async ({ act }) => {
    const log: unknown[][] = [];
    const { root, at } = await mountLayout({
      root: {
        ...logged(log),
        defaultLayout: { a: 50, b: 25, c: 25 },
        modelValue: { a: 20, b: 40, c: 40 },
        onLayoutChange: (_: unknown, details: ResizableRootChangeEventDetails) => {
          log.push(['layoutChange']);
          details.cancel();
        },
      },
      parts: three(),
    });
    await act(at);
    expect(new Set(log.map(([name]) => name))).toEqual(
      new Set(['layoutChange', ...(log.some(([name]) => name === 'draggingChange') ? ['draggingChange'] : [])]),
    );
    expect(grows(root, 'a', 'b', 'c')).toEqual(['20', '40', '40']);
  });

  test('nothing at the mount, and nothing for a key that gives the layout that the root has', async () => {
    const log: unknown[][] = [];
    const { at } = await mountLayout({
      root: { ...logged(log), defaultLayout: { a: 100, b: 0, c: 0 } },
      parts: three(),
    });
    expect(log).toEqual([]);
    await key(at('h1'), '{End}');
    expect(log).toEqual([]);
  });
});

describe('one drag in a root', () => {
  test('a press on another handle while a drag runs starts nothing; after the release it starts its own', async () => {
    const log: unknown[][] = [];
    const { root, at } = await mountLayout({ root: logged(log), parts: three() });
    await press(at('h1'));
    // A second pointer of the browser: the focus moves, but no drag starts.
    at('h2').dispatchEvent(
      new PointerEvent('pointerdown', { pointerId: 9, button: 0, buttons: 1, bubbles: true }),
    );
    expect(at('h2')).not.toHaveAttribute('data-dragging');
    await release();
    await drag(at('h2'), -40);
    expect(grows(root, 'a', 'b', 'c')).toEqual(['33.334', '23.333', '43.333']);
    expect(log.filter(([name]) => name === 'draggingChange')).toHaveLength(4);
  });

  test('each root has its own drag', async () => {
    const { at, root } = await mountLayout({
      parts: [
        { kind: 'panel', key: 'a' },
        { kind: 'handle', key: 'h1' },
        {
          kind: 'panel',
          key: 'b',
          inner: { root: { orientation: 'vertical' }, parts: panelsAndHandles('x', 'y') },
        },
      ],
    });
    const inner = root.querySelector<HTMLElement>('[data-key="inner-root"] [role="separator"]')!;
    // A made pointer has no capture.
    inner.setPointerCapture = () => {};
    await press(at('h1'));
    inner.dispatchEvent(
      new PointerEvent('pointerdown', { pointerId: 9, button: 0, buttons: 1, bubbles: true }),
    );
    await nextTick();
    expect(at('h1')).toHaveAttribute('data-dragging');
    expect(inner).toHaveAttribute('data-dragging');
    inner.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, bubbles: true }));
    await release();
  });
});

describe('prop: disabled', () => {
  test('each handle ignores the user; the app still changes the layout', async () => {
    const log: unknown[][] = [];
    const { root, spec, at } = await mountLayout({
      root: { ...logged(log), disabled: true, modelValue: { a: 30, b: 30, c: 40 } },
      parts: three(),
    });
    await drag(at('h1'), 40);
    await key(at('h2'), '{ArrowRight}');
    await doubleClick(at('h1'));
    expect(log).toEqual([]);
    spec.root!.modelValue = { a: 10, b: 10, c: 80 };
    await nextTick();
    expect(grows(root, 'a', 'b', 'c')).toEqual(['10', '10', '80']);
  });
});

describe('elements that are not panels', () => {
  test('keep their size, and are not in the panel space', async () => {
    const log: unknown[][] = [];
    const { at } = await mountLayout({
      root: logged(log),
      parts: [
        { kind: 'panel', key: 'a' },
        { kind: 'handle', key: 'h1' },
        { kind: 'element', key: 'extra', attrs: { style: 'width: 50px; flex: none' } },
        { kind: 'panel', key: 'b' },
      ],
    });
    expect(widthOf(at('extra'))).toBe(50);
    expect(widthOf(at('a'))).toBeCloseTo(175, 0);
    // The panel space is 350 px, so 35 px are 10%.
    await drag(at('h1'), 35);
    expect(log).toContainEqual(['update', { a: 60, b: 40 }]);
    expect(widthOf(at('extra'))).toBe(50);
  });

  test('an element that grows takes its room from the panels, and a fixed panel keeps its pixels', async () => {
    const { spec, at } = await mountLayout({
      parts: [
        { kind: 'panel', key: 'a', attrs: { defaultSize: '100px', rootResizeBehavior: 'fixed' } },
        { kind: 'handle', key: 'h1' },
        { kind: 'panel', key: 'b' },
        { kind: 'element', key: 'extra', attrs: { style: 'width: 0px; flex: none' } },
      ],
    });
    expect(widthOf(at('a'))).toBeCloseTo(100, 0);
    part(spec, 'extra').attrs = { style: 'width: 100px; flex: none' };
    await nextTick();
    await settle();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(widthOf(at('a'))).toBeCloseTo(100, 0);
    expect(widthOf(at('b'))).toBeCloseTo(200, 0);
  });
});

describe('panels that mount and unmount', () => {
  test('a panel that mounts with no entry gives update:modelValue alone, one time, at its place', async () => {
    const log: unknown[][] = [];
    const { root, spec, at } = await mountLayout({
      root: logged(log),
      parts: [
        { kind: 'panel', key: 'a' },
        { kind: 'handle', key: 'h1' },
        { kind: 'panel', key: 'middle', show: false },
        { kind: 'panel', key: 'b' },
      ],
    });
    expect(grows(root, 'a', 'b')).toEqual(['50', '50']);
    part(spec, 'middle').show = true;
    await settle();
    expect(at('a').getBoundingClientRect().left).toBeLessThan(at('middle').getBoundingClientRect().left);
    expect(at('middle').getBoundingClientRect().left).toBeLessThan(at('b').getBoundingClientRect().left);
    expect(grows(root, 'a', 'middle', 'b')).toEqual(['33.334', '33.333', '33.333']);
    expect(log).toEqual([['update', { a: 33.334, middle: 33.333, b: 33.333 }]]);
    expect(at('h1')).toHaveAttribute('aria-controls', 'a');
  });

  test.each(['constructor', '__proto__'])(
    'a panel id that an object also has is a key: %s',
    async (id) => {
      const log: unknown[][] = [];
      const { root, spec } = await mountLayout({
        root: { ...logged(log), defaultLayout: { a: 50, b: 50 } },
        parts: [
          { kind: 'panel', key: 'a' },
          { kind: 'panel', key: 'b' },
          { kind: 'panel', key: id, show: false },
        ],
      });
      part(spec, id).show = true;
      await settle();
      const layout = log[0]![1] as ResizableLayout;
      expect(Object.keys(layout)).toEqual(['a', 'b', id]);
      expect(Object.hasOwn(layout, id)).toBe(true);
      expect(JSON.parse(JSON.stringify(layout))).toEqual(
        JSON.parse(`{"a":33.334,"b":33.333,"${id}":33.333}`),
      );
      const sizes = JSON.parse(root.querySelector('.root-state')!.textContent!).sizes;
      expect(Object.keys(sizes)).toEqual(['a', 'b', id]);
    },
  );

  test('a panel that unmounts keeps its entry: the others share its room, and it gets its size back', async () => {
    const log: unknown[][] = [];
    const { root, spec, at } = await mountLayout({
      root: { ...logged(log), defaultLayout: { a: 60, b: 20, c: 20 } },
      parts: [
        { kind: 'panel', key: 'a' },
        { kind: 'handle', key: 'h1' },
        { kind: 'panel', key: 'b' },
        { kind: 'panel', key: 'c' },
      ],
    });
    part(spec, 'c').show = false;
    await settle();
    expect(grows(root, 'a', 'b')).toEqual(['75', '25']);
    await drag(at('h1'), 40);
    expect(log).toContainEqual(['update', { c: 20, a: 68, b: 12 }]);
    part(spec, 'c').show = true;
    await settle();
    expect(grows(root, 'a', 'b', 'c')).toEqual(['68', '12', '20']);
    expect(log.filter(([name]) => name === 'update')).toHaveLength(1);
  });

  test('a handle that mounts or unmounts changes no size', async () => {
    const log: unknown[][] = [];
    const { root, spec } = await mountLayout({
      root: { ...logged(log), defaultLayout: { a: 60, b: 40 } },
      parts: [
        { kind: 'panel', key: 'a' },
        { kind: 'handle', key: 'h1', show: false },
        { kind: 'panel', key: 'b' },
      ],
    });
    part(spec, 'h1').show = true;
    await settle();
    part(spec, 'h1').show = false;
    await settle();
    expect(grows(root, 'a', 'b')).toEqual(['60', '40']);
    expect(log).toEqual([]);
  });

  test('a panel whose id changes is a panel that mounts', async () => {
    const log: unknown[][] = [];
    const { root, spec, at } = await mountLayout({
      root: { ...logged(log), defaultLayout: { a: 70, b: 30 } },
      parts: [
        { kind: 'panel', key: 'first', attrs: { id: 'a' } },
        { kind: 'panel', key: 'b' },
      ],
    });
    expect(grows(root, 'first')).toEqual(['70']);
    part(spec, 'first').attrs = { id: 'renamed' };
    await settle();
    expect(at('first')).toHaveAttribute('id', 'renamed');
    // The old entry stays for a panel that comes back, and the mounted panels share the rest.
    expect(log).toEqual([['update', { a: 70, renamed: 21, b: 9 }]]);
  });

  test('a handle names its new neighbors after a panel mounts and unmounts', async () => {
    const { spec, at } = await mountLayout({ parts: three() });
    expect(at('h2')).toHaveAttribute('aria-valuenow', '33');
    part(spec, 'h2').show = false;
    part(spec, 'c').show = false;
    await settle();
    expect(at('h1')).toHaveAttribute('aria-valuenow', '50');
    part(spec, 'h2').show = true;
    part(spec, 'c').show = true;
    await settle();
    expect(at('h1')).toHaveAttribute('aria-valuenow', '33');
    expect(at('h2')).toHaveAttribute('aria-valuenow', '33');
  });

  test('a keyed list that moves its panels keeps each size, and each handle names its new neighbors', async () => {
    const { root, spec, at } = await mountLayout({
      root: { defaultLayout: { a: 20, b: 30, c: 50 } },
      parts: three(),
    });
    const [a, h1, b, h2, c] = spec.parts;
    spec.parts = [c!, h1!, a!, h2!, b!];
    await settle();
    expect(grows(root, 'a', 'b', 'c')).toEqual(['20', '30', '50']);
    expect(at('h1')).toHaveAttribute('aria-controls', 'c');
    expect(at('h1')).toHaveAttribute('aria-valuenow', '50');
    expect(at('h2')).toHaveAttribute('aria-controls', 'a');
  });

  test('a v-if/v-else swap of two panels with one id keeps the size, with no warning', async () => {
    const swap = reactive({ second: false });
    const { root } = mount(ResizableSwap, { swap });
    await settle();
    const size = () => root.querySelector<HTMLElement>('#main')!.style.flexGrow;
    expect(size()).toBe('70');
    swap.second = true;
    await settle();
    expect(root.querySelector('#main')).toHaveAttribute('data-variant', 'second');
    expect(size()).toBe('70');
  });

  test('KeepAlive: a held panel gives its room to the others, and gets it back with no event', async () => {
    const log: unknown[][] = [];
    const scene = reactive({ show: true, root: logged(log) });
    const { root } = mount(ResizableKeptAlive, { scene });
    await settle();
    const grow = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!.style.flexGrow;
    expect([grow('a'), grow('b'), grow('c')]).toEqual(['20', '30', '50']);
    scene.show = false;
    await settle();
    expect([grow('a'), grow('b')]).toEqual(['40', '60']);
    expect(root.querySelector('[data-key="h2"]')).toBeNull();
    expect(root.querySelector('[data-key="h1"]')).toHaveAttribute('aria-valuemax', '100');
    scene.show = true;
    await settle();
    expect([grow('a'), grow('b'), grow('c')]).toEqual(['20', '30', '50']);
    expect(log).toEqual([]);
  });
});

describe('nested roots', () => {
  test('keep their layouts apart', async () => {
    const outer: unknown[][] = [];
    const inner: unknown[][] = [];
    const { at, root } = await mountLayout(
      {
        root: logged(outer),
        parts: [
          { kind: 'panel', key: 'a', attrs: { defaultSize: 60 } },
          { kind: 'handle', key: 'h1' },
          {
            kind: 'panel',
            key: 'b',
            inner: { root: { orientation: 'vertical', ...logged(inner) }, parts: panelsAndHandles('x', 'y') },
          },
        ],
      },
      'width: 400px; height: 400px',
    );
    const innerHandle = root.querySelector<HTMLElement>('[data-key="inner-root"] [role="separator"]')!;
    expect(innerHandle).toHaveAttribute('aria-controls', 'x');
    expect(at('h1')).toHaveAttribute('aria-controls', 'a');
    await drag(innerHandle, 0, 40);
    expect(inner).toContainEqual(['update', { x: 60, y: 40 }]);
    expect(outer).toEqual([]);
    await drag(at('h1'), 40);
    expect(outer).toContainEqual(['update', { a: 70, b: 30 }]);
  });
});

describe('F6', () => {
  // A listener of the document reads the key after the root. It then stops the action of the
  // browser: Firefox moves the focus out of the page for an F6 that no listener prevented.
  function recordPrevented() {
    const prevented: boolean[] = [];
    const listener = (event: KeyboardEvent) => {
      if (event.key !== 'F6') return;
      prevented.push(event.defaultPrevented);
      event.preventDefault();
    };
    document.addEventListener('keydown', listener);
    onTestFinished(() => document.removeEventListener('keydown', listener));
    return prevented;
  }

  function panes(controls: Record<string, string[]> = { a: ['A'], b: ['B'], c: ['C'] }) {
    return panelsAndHandles('a', 'b', 'c').map((each) => ({
      ...each,
      controls: controls[each.key] ?? [],
    }));
  }

  const focused = () => document.activeElement?.id;

  test.each([
    { name: 'F6 from a control', from: 'B', keys: '{F6}', to: 'C' },
    { name: 'Shift+F6 from a control', from: 'B', keys: '{Shift>}{F6}{/Shift}', to: 'A' },
    { name: 'F6 from a handle', from: 'h1', keys: '{F6}', to: 'B' },
    { name: 'Shift+F6 from a handle', from: 'h1', keys: '{Shift>}{F6}{/Shift}', to: 'A' },
    { name: 'F6 from the last pane', from: 'C', keys: '{F6}', to: 'A' },
    { name: 'Shift+F6 from the first pane', from: 'A', keys: '{Shift>}{F6}{/Shift}', to: 'C' },
  ])('moves the focus to the next pane, and loops: $name', async ({ from, keys, to }) => {
    const prevented = recordPrevented();
    const { root } = await mountLayout({ parts: panes() });
    (root.querySelector<HTMLElement>(`#${from}`) ?? byKey(root, from)).focus();
    await userEvent.keyboard(keys);
    expect(focused()).toBe(to);
    expect(prevented).toEqual([true]);
  });

  test('passes over a pane with no tabbable element and a pane of size 0; works in a disabled root', async () => {
    const { root, spec, exposed } = await mountLayout({
      root: { disabled: true },
      parts: panes({ a: ['A'], c: ['C'] }).map((each) =>
        each.key === 'c' ? { ...each, attrs: { collapsible: true, minSize: 10 } } : each,
      ),
    });
    spec.parts.push({ kind: 'handle', key: 'h3' }, { kind: 'panel', key: 'd', controls: ['D'] });
    await settle();
    (exposed.panels.c as { collapse(): void }).collapse();
    await settle();
    expect(byKey(root, 'c').style.flexGrow).toBe('0');
    root.querySelector<HTMLElement>('#A')!.focus();
    await userEvent.keyboard('{F6}');
    expect(focused()).toBe('D');
  });

  test('a nested root gives the key to the outer root at its last pane', async () => {
    const { root } = await mountLayout({
      parts: panes({ a: ['A'], c: ['C'] }).map((each) =>
        each.key === 'b'
          ? {
              ...each,
              inner: {
                root: { orientation: 'vertical' },
                parts: panelsAndHandles('x', 'y').map((inner) => ({
                  ...inner,
                  controls: inner.kind === 'panel' ? [inner.key.toUpperCase()] : [],
                })),
              },
            }
          : each,
      ),
    });
    root.querySelector<HTMLElement>('#Y')!.focus();
    await userEvent.keyboard('{F6}');
    expect(focused()).toBe('C');
    root.querySelector<HTMLElement>('#X')!.focus();
    await userEvent.keyboard('{F6}');
    expect(focused()).toBe('Y');
  });

  test('a root in an element of the outer root that is not a panel loops in itself', async () => {
    const prevented = recordPrevented();
    const { root } = await mountLayout({
      parts: [
        ...panes({ a: ['A'], b: ['B'] }).slice(0, 3),
        {
          kind: 'element',
          key: 'side',
          controls: ['Side'],
        },
      ],
    });
    // The control in the element that is not a panel is in no pane.
    root.querySelector<HTMLElement>('#Side')!.focus();
    await userEvent.keyboard('{F6}');
    expect(focused()).toBe('Side');
    expect(prevented).toEqual([false]);
  });

  test('a control in a shadow tree counts for its pane', async () => {
    const { root } = await mountLayout({ parts: panes({ a: [], b: ['B'], c: ['C'] }) });
    const shadow = byKey(root, 'a').appendChild(document.createElement('div')).attachShadow({ mode: 'open' });
    shadow.innerHTML = '<slot></slot><button id="in-shadow">In shadow</button>';
    shadow.querySelector<HTMLElement>('#in-shadow')!.focus();
    await userEvent.keyboard('{F6}');
    expect(focused()).toBe('B');
  });

  test('does not prevent the key when no pane has a control, nor with Ctrl, Alt or Meta, nor after a listener prevented it', async () => {
    const prevented = recordPrevented();
    const { root } = await mountLayout({ parts: panes({}) });
    byKey(root, 'h1').focus();
    await userEvent.keyboard('{F6}');
    expect(document.activeElement).toBe(byKey(root, 'h1'));

    const withControls = await mountLayout({ parts: panes() });
    const b = withControls.root.querySelector<HTMLElement>('#B')!;
    for (const keys of ['{Control>}{F6}{/Control}', '{Alt>}{F6}{/Alt}', '{Meta>}{F6}{/Meta}']) {
      b.focus();
      await userEvent.keyboard(keys);
      expect(document.activeElement).toBe(b);
    }
    b.addEventListener('keydown', (event) => event.preventDefault());
    await userEvent.keyboard('{F6}');
    expect(document.activeElement).toBe(b);
    expect(prevented).toEqual([false, false, false, false, true]);
  });
});

describe('development warnings', () => {
  test.each([
    {
      name: 'two panels with one id',
      parts: [
        { kind: 'panel' as const, key: 'a', attrs: { id: 'same' } },
        { kind: 'panel' as const, key: 'b', attrs: { id: 'same' } },
      ],
      message:
        'Two panels of one root have the id "same". The layout has one size for each id, so the panels cannot have sizes of their own. Give each panel an id of its own.',
    },
    {
      name: 'sizes that cannot sum to 100',
      parts: [
        { kind: 'panel' as const, key: 'a', attrs: { minSize: 60 } },
        { kind: 'panel' as const, key: 'b', attrs: { minSize: 60 } },
      ],
      message:
        'The sizes of the panels cannot sum to 100. The minimum and maximum sizes of the panels leave no layout that fills the root. Raise a `maxSize` or lower a `minSize`.',
    },
    {
      name: 'a collapsible panel that cannot collapse',
      parts: [
        { kind: 'panel' as const, key: 'a', attrs: { collapsible: true, minSize: 0 } },
        { kind: 'panel' as const, key: 'b' },
      ],
      message:
        'The panel "a" is collapsible, and its `minSize` is not greater than its `collapsedSize`. A collapsible panel collapses when it goes below its `minSize`, so this panel cannot collapse. Give the panel a `minSize` that is greater than its `collapsedSize`.',
    },
    {
      name: 'each panel fixed',
      parts: [
        { kind: 'panel' as const, key: 'a', attrs: { rootResizeBehavior: 'fixed' } },
        { kind: 'panel' as const, key: 'b', attrs: { rootResizeBehavior: 'fixed' } },
      ],
      message:
        'Each panel of the root is fixed. A fixed panel keeps its size in pixels when the root changes size, so no panel can take the change, and each panel is proportional. Leave the `rootResizeBehavior` of one panel at `proportional`.',
    },
    {
      name: 'a size prop that is not valid',
      parts: [
        { kind: 'panel' as const, key: 'a', attrs: { minSize: '1fr' } },
        { kind: 'panel' as const, key: 'b' },
      ],
      message:
        'The panel "a" has the minSize "1fr", which is not valid. The panel ignores this size. Use a number of 0 or more, or a string of such a number with an optional unit: "%", "px", "em", "rem", "vh" or "vw".',
    },
  ])('warns one time: $name', async ({ parts, message }) => {
    const { spec } = await mountLayout({ parts });
    spec.parts = [...spec.parts];
    await settle();
    expect(takeReportedMessages()).toEqual([`console.warn: Vase UI: ${message}`]);
  });

  test('a v-if/v-else swap of panels with one id gives no warning', async () => {
    const swap = reactive({ second: false });
    mount(ResizableSwap, { swap });
    await settle();
    swap.second = true;
    await settle();
    expect(takeReportedMessages()).toEqual([]);
  });
});

// The case throws in `setup`, so it is the last of the file.
describe('a part outside the root', () => {
  test('throws an error that names the part and the root', () => {
    expect(String(mountError(ResizableOutsideRoot))).toContain(
      'Vase UI Resizable: <Resizable.Panel> must be inside <Resizable.Root>.',
    );
    takeReportedMessages();
  });
});
