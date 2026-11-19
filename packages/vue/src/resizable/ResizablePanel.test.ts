import { describe, expect, onTestFinished, test } from 'vitest';
import { nextTick, reactive } from 'vue';
import type { ResizableLayout } from '@vase-ui/vue/resizable';
import ResizableElements from '../../test/fixtures/ResizableElements.vue';
import ResizableLayoutFixture from '../../test/fixtures/ResizableLayout.vue';
import { takeReportedMessages } from '../../test/reportedMessages';
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

interface PanelMethods {
  element: HTMLElement;
  collapse(): void;
  expand(): void;
  resize(size: number | string): void;
  isCollapsed(): boolean;
}

// The frame is 400 px wide, and a handle has no size, so 1% of the panel space is 4 px.
async function mountPanels(
  panels: Record<string, unknown>[],
  options: { root?: Record<string, unknown>; frame?: string } = {},
) {
  const parts: LayoutPart[] = panels.flatMap((attrs, index) => [
    ...(index > 0 ? [{ kind: 'handle' as const, key: `h${index}` }] : []),
    { kind: 'panel' as const, key: `p${index}`, attrs },
  ]);
  const spec = reactive<LayoutSpec>({
    root: options.root ?? {},
    parts,
    ...(options.frame && { frame: options.frame }),
  });
  const { root, exposed } = mount(ResizableLayoutFixture, { spec });
  await settle();
  const at = (key: string) => byKey(root, key);
  return {
    root,
    spec,
    at,
    panel: (index: number) => exposed.panels[`p${index}`] as PanelMethods,
    flex: (...indexes: number[]) => grows(root, ...indexes.map((index) => `p${index}`)),
    width: (index: number) => widthOf(at(`p${index}`)),
    /** Gives the frame another width, and waits for the root to read it. */
    async resizeFrame(width: number) {
      spec.frame = `width: ${width}px; height: 100px`;
      await nextTick();
      await frames();
    },
  };
}

/** A v-model on the root that writes each update in `log`. */
function model(log: ResizableLayout[], first: ResizableLayout = {}) {
  const root = reactive<Record<string, unknown>>({ modelValue: first });
  root['onUpdate:modelValue'] = (layout: ResizableLayout) => {
    log.push(layout);
    root.modelValue = layout;
  };
  return root;
}

describe('prop: id', () => {
  test('is the id of the element and the key of the layout; with none, a generated id that the handle names', async () => {
    const log: ResizableLayout[] = [];
    const named = await mountPanels([{ id: 'sidebar' }, { id: 'content' }], { root: model(log) });
    expect(named.at('p0')).toHaveAttribute('id', 'sidebar');
    await drag(named.at('h1'), 40);
    expect(log).toEqual([{ sidebar: 60, content: 40 }]);

    const generated = await mountPanels([{ id: undefined }, { id: ' ' }]);
    const id = generated.at('p0').id;
    expect(id).not.toBe('');
    expect(generated.at('p1').id).not.toBe(' ');
    expect(id).not.toBe(generated.at('p1').id);
    expect(generated.at('h1')).toHaveAttribute('aria-controls', id);
  });
});

describe('style', () => {
  test('flex: S 1 0px, min-width: 0, and the variable with no unit; the panels fill the root by their sizes', async () => {
    const { at, flex, width } = await mountPanels([{ defaultSize: 25 }, {}, {}]);
    for (const key of ['p0', 'p1', 'p2']) {
      expect(at(key).style.flexShrink).toBe('1');
      expect(at(key).style.flexBasis).toBe('0px');
      expect(at(key).style.minWidth).toBe('0px');
      expect(at(key).style.minHeight).toBe('');
    }
    expect(flex(0, 1, 2)).toEqual(['25', '37.5', '37.5']);
    expect(at('p0').style.getPropertyValue('--resizable-panel-size')).toBe('25');
    expect(width(0)).toBeCloseTo(100, 0);
    await drag(at('h1'), 20);
    expect(at('p0').style.getPropertyValue('--resizable-panel-size')).toBe('30');
  });

  test('min-height: 0 in a vertical root; the style of the developer wins', async () => {
    const { at } = await mountPanels([{ style: { flex: '1 1 auto', color: 'red' } }, {}], {
      root: { orientation: 'vertical' },
    });
    expect(at('p0').style.flexBasis).toBe('auto');
    expect(at('p0').style.color).toBe('red');
    expect(at('p1').style.minHeight).toBe('0px');
    expect(at('p1').style.minWidth).toBe('');
  });

  test('the attributes and the listeners of the developer reach the element, and both listeners run', async () => {
    const clicks: string[] = [];
    const { at } = await mountPanels([
      { class: 'Panel', 'data-x': 'y', onClick: () => clicks.push('developer') },
      {},
    ]);
    at('p0').click();
    expect(at('p0')).toHaveClass('Panel');
    expect(at('p0')).toHaveAttribute('data-x', 'y');
    expect(clicks).toEqual(['developer']);
  });
});

describe('prop: defaultSize', () => {
  test.each([
    { name: 'a number', defaultSize: 30 },
    { name: 'a string of a number', defaultSize: '30' },
    { name: 'a percent string', defaultSize: '30%' },
  ])('is the first size: $name', async ({ defaultSize }) => {
    const { flex } = await mountPanels([{ defaultSize }, {}]);
    expect(flex(0, 1)).toEqual(['30', '70']);
  });

  test('an entry of the layout wins; panels with no size share the rest; a later change has no effect', async () => {
    const withEntry = await mountPanels([{ id: 'a', defaultSize: 30 }, { id: 'b' }], {
      root: { defaultLayout: { a: 60 } },
    });
    expect(withEntry.flex(0, 1)).toEqual(['60', '40']);
    const shared = await mountPanels([{ defaultSize: 40 }, {}, {}]);
    expect(shared.flex(0, 1, 2)).toEqual(['40', '30', '30']);
    shared.spec.parts[0]!.attrs = { defaultSize: 80 };
    await nextTick();
    expect(shared.flex(0, 1, 2)).toEqual(['40', '30', '30']);
  });
});

describe('prop: minSize and maxSize', () => {
  test('hold in a drag and in a key', async () => {
    const { at, flex } = await mountPanels([{ maxSize: 70 }, { minSize: 20 }]);
    await drag(at('h1'), 120);
    expect(flex(0, 1)).toEqual(['70', '30']);
    await drag(at('h1'), -280);
    expect(flex(0, 1)).toEqual(['0', '100']);
    const keys = await mountPanels([{ minSize: '30%' }, { minSize: 30, maxSize: '60' }]);
    await key(keys.at('h1'), '{End}');
    expect(keys.flex(0, 1)).toEqual(['70', '30']);
    await key(keys.at('h1'), '{Home}');
    expect(keys.flex(0, 1)).toEqual(['40', '60']);
  });

  test.each([
    { name: 'minimum', prop: 'minSize', to: 70, sizes: ['70', '30'] },
    { name: 'maximum', prop: 'maxSize', to: 20, sizes: ['20', '80'] },
  ])('a new $name moves the layout with no event', async ({ prop, to, sizes }) => {
    const log: ResizableLayout[] = [];
    const { spec, flex } = await mountPanels([{}, {}], { root: model(log) });
    spec.parts[0]!.attrs = { [prop]: to };
    await nextTick();
    expect(flex(0, 1)).toEqual(sizes);
    expect(log).toEqual([]);
  });
});

describe('state', () => {
  test('the default slot and the element slot get the orientation, the size, collapsed and disabled', async () => {
    const { root } = mount(ResizableElements, { orientation: 'vertical' });
    await settle();
    const section = root.querySelector('section')!;
    expect(JSON.parse(section.dataset.state!)).toEqual({
      orientation: 'vertical',
      size: 30,
      collapsed: false,
      disabled: true,
    });
    expect(section).toHaveAttribute('data-orientation', 'vertical');
    expect(section).toHaveAttribute('data-disabled');
    expect(section).not.toHaveAttribute('data-size');
    expect(root.querySelector('.panel-state')).toHaveTextContent('"size":70');
  });
});

describe('prop: collapsible', () => {
  // The least size is 20 and the collapsed size 0, so the middle of the distance is 10: 40 px.
  const collapsible = { collapsible: true, minSize: 20 };

  test('data-collapsed and the state follow a drag that passes the middle of the distance', async () => {
    const { at, root } = await mountPanels([{ ...collapsible, defaultSize: 40 }, {}]);
    const state = () => JSON.parse(at('p0').querySelector('.panel-state')!.textContent!);
    expect(at('p0')).not.toHaveAttribute('data-collapsed');
    await drag(at('h1'), -124);
    expect(at('p0')).toHaveAttribute('data-collapsed');
    expect(state().collapsed).toBe(true);
    await drag(at('h1'), 44);
    expect(at('p0')).not.toHaveAttribute('data-collapsed');
    expect(root).toBeTruthy();
  });

  test.each([
    {
      name: 'stops at the least size above the middle',
      first: 40,
      distance: -100,
      sizes: ['20', '80'],
    },
    { name: 'collapses below the middle', first: 40, distance: -124, sizes: ['0', '100'] },
    { name: 'stays collapsed below the middle', first: 0, distance: 36, sizes: ['0', '100'] },
    { name: 'expands above the middle', first: 0, distance: 44, sizes: ['20', '80'] },
    { name: 'goes on past the least size', first: 0, distance: 120, sizes: ['30', '70'] },
  ])('a drag $name', async ({ first, distance, sizes }) => {
    const { at, flex } = await mountPanels([{ ...collapsible, defaultSize: first }, {}]);
    await drag(at('h1'), distance);
    expect(flex(0, 1)).toEqual(sizes);
  });

  test('a collapsed size stays while the panel is collapsed; a panel that starts at it is collapsed with no event', async () => {
    const events: boolean[] = [];
    const { at, flex } = await mountPanels([
      {
        ...collapsible,
        collapsedSize: 4,
        defaultSize: 4,
        onCollapsedChange: (value: boolean) => events.push(value),
      },
      {},
    ]);
    expect(flex(0, 1)).toEqual(['4', '96']);
    expect(at('p0')).toHaveAttribute('data-collapsed');
    expect(events).toEqual([]);
  });

  test('collapsedChange comes after the DOM update for a drag and for a layout of the app, and not for another change', async () => {
    const events: [boolean, boolean][] = [];
    const root = reactive<Record<string, unknown>>({ modelValue: { a: 40, b: 60 } });
    root['onUpdate:modelValue'] = (layout: ResizableLayout) => (root.modelValue = layout);
    const { at } = await mountPanels(
      [
        {
          ...collapsible,
          id: 'a',
          onCollapsedChange: (value: boolean) =>
            events.push([value, at('p0').hasAttribute('data-collapsed')]),
        },
        { id: 'b' },
      ],
      { root },
    );
    await drag(at('h1'), -40);
    expect(events).toEqual([]);
    await drag(at('h1'), -84);
    expect(events).toEqual([[true, true]]);
    await drag(at('h1'), 12);
    root.modelValue = { a: 30, b: 70 };
    await settle();
    expect(events).toEqual([
      [true, true],
      [false, false],
    ]);
    root.modelValue = { a: 0, b: 100 };
    await settle();
    expect(events.at(-1)).toEqual([true, true]);
  });
});

describe('prop: collapseThreshold', () => {
  // A threshold of 5 collapses a panel below 15 and expands it above 5.
  test.each([
    {
      name: 'a number collapses below 15',
      threshold: 5,
      first: 40,
      distance: -104,
      sizes: ['0', '100'],
    },
    { name: 'a number stops at 16', threshold: 5, first: 40, distance: -96, sizes: ['20', '80'] },
    {
      name: 'a percent collapses below 15',
      threshold: '5%',
      first: 40,
      distance: -104,
      sizes: ['0', '100'],
    },
    { name: 'a number expands above 5', threshold: 5, first: 0, distance: 24, sizes: ['20', '80'] },
    {
      name: 'a number stays collapsed at 4',
      threshold: 5,
      first: 0,
      distance: 16,
      sizes: ['0', '100'],
    },
  ])('is the distance from the limits: $name', async ({ threshold, first, distance, sizes }) => {
    const { at, flex } = await mountPanels([
      { collapsible: true, minSize: 20, collapseThreshold: threshold, defaultSize: first },
      {},
    ]);
    await drag(at('h1'), distance);
    expect(flex(0, 1)).toEqual(sizes);
  });
});

describe('methods', () => {
  const collapsible = { id: 'a', collapsible: true, minSize: 20 };

  test('each method gives update:modelValue alone; collapse() and expand() give the size from before', async () => {
    const log: unknown[][] = [];
    const root = {
      onLayoutChange: () => log.push(['layoutChange']),
      'onUpdate:modelValue': (layout: ResizableLayout) => log.push(['update', layout]),
      onLayoutCommitted: () => log.push(['layoutCommitted']),
    };
    const { panel, flex } = await mountPanels([{ ...collapsible, defaultSize: 40 }, { id: 'b' }], {
      root,
    });
    expect(panel(0).isCollapsed()).toBe(false);
    panel(0).collapse();
    await nextTick();
    expect(flex(0, 1)).toEqual(['0', '100']);
    expect(panel(0).isCollapsed()).toBe(true);
    panel(0).expand();
    await nextTick();
    expect(flex(0, 1)).toEqual(['40', '60']);
    panel(0).resize('30%');
    await nextTick();
    expect(log).toEqual([
      ['update', { a: 0, b: 100 }],
      ['update', { a: 40, b: 60 }],
      ['update', { a: 30, b: 70 }],
    ]);
  });

  test('in an uncontrolled root, a second method starts from the layout of the first', async () => {
    const { panel, flex } = await mountPanels([collapsible, { id: 'b' }]);
    panel(0).resize(35);
    panel(0).collapse();
    expect(panel(0).isCollapsed()).toBe(true);
    panel(0).expand();
    await nextTick();
    expect(flex(0, 1)).toEqual(['35', '65']);
  });

  test('in a controlled root, each method starts from the layout of the parent, so a second one comes after nextTick', async () => {
    const log: ResizableLayout[] = [];
    const { panel, flex } = await mountPanels([collapsible, { id: 'b' }], {
      root: model(log, { a: 50, b: 50 }),
    });
    panel(0).resize(35);
    panel(0).resize(30);
    expect(log).toEqual([
      { a: 35, b: 65 },
      { a: 30, b: 70 },
    ]);
    await nextTick();
    panel(0).collapse();
    expect(panel(0).isCollapsed()).toBe(false);
    await nextTick();
    expect(panel(0).isCollapsed()).toBe(true);
    panel(0).expand();
    await nextTick();
    expect(flex(0, 1)).toEqual(['30', '70']);
  });

  test.each([
    { name: 'in one move', drags: [[-160]], sizes: ['40', '60'] },
    { name: 'in two moves', drags: [[-100, -160]], sizes: ['40', '60'] },
    { name: 'from the least size', drags: [[-80], [-80]], sizes: ['20', '80'] },
  ])(
    'expand() gives the size from the start of the drag that collapsed it: $name',
    async ({ drags, sizes }) => {
      const { at, panel, flex } = await mountPanels([
        { ...collapsible, defaultSize: 40 },
        { id: 'b' },
      ]);
      for (const moves of drags) {
        const start = await press(at('h1'));
        for (const distance of moves) await moveTo({ x: start.x + distance, y: start.y });
        await release();
      }
      expect(flex(0, 1)).toEqual(['0', '100']);
      panel(0).expand();
      await nextTick();
      expect(flex(0, 1)).toEqual(sizes);
    },
  );

  test('expand() gives the least size with no size from before, and takes no room that would collapse another panel', async () => {
    const first = await mountPanels([{ ...collapsible, defaultSize: 0 }, { id: 'b' }]);
    first.panel(0).expand();
    await nextTick();
    expect(first.flex(0, 1)).toEqual(['20', '80']);

    const three = await mountPanels(
      [
        { id: 'nav', collapsible: true, minSize: 20 },
        { id: 'editor', minSize: 30 },
        { id: 'preview', collapsible: true, minSize: 20 },
      ],
      { root: { defaultLayout: { nav: 60, editor: 40, preview: 0 } } },
    );
    three.panel(0).collapse();
    await nextTick();
    three.panel(2).expand();
    await nextTick();
    expect(three.flex(0, 1, 2)).toEqual(['0', '80', '20']);
    three.panel(0).expand();
    await nextTick();
    expect(three.flex(0, 1, 2)).toEqual(['50', '30', '20']);
    expect(three.panel(2).isCollapsed()).toBe(false);
  });

  test.each([
    { name: 'a number', size: 30, sizes: ['30', '70'] },
    { name: 'a string of a number', size: '30', sizes: ['30', '70'] },
    { name: 'a size below the least size', size: 5, sizes: ['0', '100'] },
    { name: 'a length', size: '100px', sizes: ['25', '75'] },
  ])('resize() gives the panel $name', async ({ size, sizes }) => {
    const { panel, flex } = await mountPanels([{ ...collapsible, defaultSize: 40 }, { id: 'b' }]);
    panel(0).resize(size);
    await nextTick();
    expect(flex(0, 1)).toEqual(sizes);
  });

  test('resize() takes only what another panel has above its least size; the last panel collapses into the one before', async () => {
    const three = await mountPanels(
      [
        { id: 'nav', collapsible: true, minSize: 20 },
        { id: 'editor', minSize: 30 },
        { id: 'preview', collapsible: true, minSize: 20 },
      ],
      { root: { defaultLayout: { nav: 30, editor: 30, preview: 40 } } },
    );
    three.panel(1).resize(70);
    await nextTick();
    expect(three.flex(0, 1, 2)).toEqual(['30', '50', '20']);
    three.panel(2).collapse();
    await nextTick();
    expect(three.flex(0, 1, 2)).toEqual(['30', '70', '0']);
    three.panel(2).expand();
    await nextTick();
    expect(three.flex(0, 1, 2)).toEqual(['30', '50', '20']);
  });

  test('a method pushes the panels in a root that does not push, works on a disabled panel and in a disabled root, and does not snap', async () => {
    const { panel, flex } = await mountPanels(
      [
        {
          id: 'a',
          collapsible: true,
          minSize: 20,
          disabled: true,
          snapPoints: [40],
          snapTolerance: 10,
        },
        { id: 'b', minSize: 20 },
        { id: 'c' },
      ],
      { root: { pushPanels: false, disabled: true, defaultLayout: { a: 0, b: 20, c: 80 } } },
    );
    panel(0).expand();
    await nextTick();
    expect(flex(0, 1, 2)).toEqual(['20', '20', '60']);
    panel(0).resize(43);
    await nextTick();
    expect(flex(0, 1, 2)).toEqual(['43', '20', '37']);
  });

  test.each([
    {
      name: 'collapse() of a panel that is not collapsible',
      act: (p: (i: number) => PanelMethods) => p(1).collapse(),
    },
    {
      name: 'collapse() of a collapsed panel',
      act: (p: (i: number) => PanelMethods) => p(2).collapse(),
    },
    {
      name: 'expand() of a panel that is not collapsed',
      act: (p: (i: number) => PanelMethods) => p(0).expand(),
    },
    { name: 'resize() to the same size', act: (p: (i: number) => PanelMethods) => p(0).resize(40) },
  ])('emits nothing for $name', async ({ act }) => {
    const log: ResizableLayout[] = [];
    const { panel } = await mountPanels(
      [
        { ...collapsible, defaultSize: 40 },
        { id: 'b', defaultSize: 30 },
        { id: 'c', collapsible: true, minSize: 20, defaultSize: 0 },
        { id: 'd' },
      ],
      { root: { 'onUpdate:modelValue': (layout: ResizableLayout) => log.push(layout) } },
    );
    act(panel);
    await nextTick();
    expect(log).toEqual([]);
  });
});

describe('prop: disabled', () => {
  test('data-disabled; a drag goes through the panel to the next one', async () => {
    const { at, flex } = await mountPanels(
      [{ id: 'a' }, { id: 'b', disabled: true }, { id: 'c' }],
      {
        root: { defaultLayout: { a: 30, b: 30, c: 40 } },
      },
    );
    expect(at('p1')).toHaveAttribute('data-disabled');
    expect(at('p0')).not.toHaveAttribute('data-disabled');
    await drag(at('h1'), 40);
    expect(flex(0, 1, 2)).toEqual(['40', '30', '30']);
    await drag(at('h2'), -80);
    expect(flex(0, 1, 2)).toEqual(['20', '30', '50']);
  });

  test('a handle with only disabled panels on one side moves nothing; Enter and a double click stay with the browser', async () => {
    const log: ResizableLayout[] = [];
    const { at } = await mountPanels(
      [{ id: 'a', collapsible: true, minSize: 20, disabled: true }, { id: 'b' }],
      {
        root: {
          defaultLayout: { a: 50, b: 50 },
          'onUpdate:modelValue': (l: ResizableLayout) => log.push(l),
        },
      },
    );
    await key(at('h1'), '{ArrowRight}{ArrowLeft}{Home}{End}{Enter}');
    await doubleClick(at('h1'));
    expect(log).toEqual([]);
    expect(at('h1')).toHaveAttribute('aria-valuemin', '50');
    expect(at('h1')).toHaveAttribute('aria-valuemax', '50');
  });
});

describe('sizes with a unit', () => {
  const rem = () => Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const units = [
    { name: 'px', size: '100px', style: undefined, pixels: () => 100 },
    { name: 'em', size: '5em', style: { fontSize: '20px' }, pixels: () => 100 },
    { name: 'rem', size: '6rem', style: { fontSize: '24px' }, pixels: () => 6 * rem() },
    { name: 'vw', size: '20vw', style: undefined, pixels: () => window.innerWidth * 0.2 },
    { name: 'vh', size: '10vh', style: undefined, pixels: () => window.innerHeight * 0.1 },
  ] as const;

  test.each(units)(
    '$name: the first size, the least size and the greatest size',
    async ({ size, style, pixels }) => {
      const first = await mountPanels([{ defaultSize: size, style }, {}]);
      expect(first.width(0)).toBeCloseTo(pixels(), 0);
      expect(first.width(1)).toBeCloseTo(400 - pixels(), 0);
      const least = await mountPanels([{ minSize: size, style }, {}]);
      await drag(least.at('h1'), -190);
      expect(least.width(0)).toBeCloseTo(pixels(), 0);
      const greatest = await mountPanels([{ maxSize: size, style }, {}]);
      await drag(greatest.at('h1'), 190);
      expect(greatest.width(0)).toBeCloseTo(pixels(), 0);
    },
  );

  test.each(units)(
    '$name: the collapsed size and the collapse threshold',
    async ({ size, style, pixels }) => {
      const collapsed = await mountPanels([
        { collapsible: true, minSize: 60, defaultSize: 70, collapsedSize: size, style },
        {},
      ]);
      await key(collapsed.at('h1'), '{Enter}');
      expect(collapsed.width(0)).toBeCloseTo(pixels(), 0);
      // The least size is 50%: 200 px.
      const threshold = await mountPanels([
        { collapsible: true, minSize: 50, defaultSize: 50, collapseThreshold: size, style },
        {},
      ]);
      await drag(threshold.at('h1'), -(pixels() - 2));
      expect(threshold.width(0)).toBeCloseTo(200, 0);
      await drag(threshold.at('h1'), -(pixels() + 2));
      expect(threshold.width(0)).toBeCloseTo(0, 0);
    },
  );

  test('a panel of a vertical root has pixels of its height; the padding and the border are not in the panel space', async () => {
    const vertical = await mountPanels([{ defaultSize: '25px', minSize: '20px' }, {}], {
      root: { orientation: 'vertical' },
    });
    expect(vertical.at('p0').getBoundingClientRect().height).toBeCloseTo(25, 0);
    const padded = await mountPanels([
      { defaultSize: '100px', style: { padding: '0 30px', border: '5px solid' } },
      { style: { padding: '0 10px' } },
    ]);
    expect(padded.width(0)).toBeCloseTo(100 + 70, 0);
  });

  test('a least size in pixels holds when the root gets smaller, and the layout comes back', async () => {
    const { width, resizeFrame } = await mountPanels([{ minSize: '100px', defaultSize: 40 }, {}]);
    expect(width(0)).toBeCloseTo(160, 0);
    await resizeFrame(200);
    expect(width(0)).toBeCloseTo(100, 0);
    await resizeFrame(400);
    expect(width(0)).toBeCloseTo(160, 0);
  });

  test('a size in vw follows the window, also for a root of a fixed width', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    onTestFinished(() => {
      if (descriptor) Object.defineProperty(window, 'innerWidth', descriptor);
      else Reflect.deleteProperty(window, 'innerWidth');
    });
    const { width } = await mountPanels([{ minSize: '10vw', defaultSize: 5 }, {}]);
    await frames();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 2000 });
    window.dispatchEvent(new Event('resize'));
    await nextTick();
    expect(width(0)).toBeCloseTo(200, 0);
  });

  test('the root reads the font size of a panel again at the next drag', async () => {
    const { spec, at, width } = await mountPanels([
      { minSize: '5em', defaultSize: 40, style: { fontSize: '10px' } },
      {},
    ]);
    expect(width(0)).toBeCloseTo(160, 0);
    // The least size was 50 px. It is 150 px with the new font size.
    spec.parts[0]!.attrs = { minSize: '5em', defaultSize: 40, style: { fontSize: '30px' } };
    await nextTick();
    await drag(at('h1'), -60);
    expect(width(0)).toBeCloseTo(150, 0);
  });

  test('a first size in a length keeps its percent at a new size of the root; a double click gives the pixels again', async () => {
    const { at, width, resizeFrame } = await mountPanels([{ defaultSize: '100px' }, {}]);
    await drag(at('h1'), 40);
    expect(width(0)).toBeCloseTo(140, 0);
    await resizeFrame(200);
    expect(width(0)).toBeCloseTo(70, 0);
    await doubleClick(at('h1'));
    expect(width(0)).toBeCloseTo(100, 0);
  });

  test('no warning when lengths cannot fit a small root, nor for a collapsible panel with a least size in a length', async () => {
    await mountPanels([{ minSize: '300px' }, { minSize: '300px' }]);
    await mountPanels([{ collapsible: true, minSize: '6rem', collapsedSize: '24px' }, {}]);
    expect(takeReportedMessages()).toEqual([]);
    await mountPanels([{ id: 'x', collapsible: true, minSize: '20px', collapsedSize: '24px' }, {}]);
    await settle();
    expect(takeReportedMessages()).toEqual([
      expect.stringMatching(/^console\.warn: Vase UI: The panel "x" is collapsible/),
    ]);
  });

  test('a size prop that is not valid has no effect, with a warning, and no error', async () => {
    const { flex } = await mountPanels([{ id: 'x', defaultSize: 'wide', maxSize: -1 }, {}]);
    expect(flex(0, 1)).toEqual(['50', '50']);
    expect(takeReportedMessages().sort()).toEqual([
      'console.warn: Vase UI: The panel "x" has the defaultSize "wide", which is not valid. The panel ignores this size. Use a number of 0 or more, or a string of such a number with an optional unit: "%", "px", "em", "rem", "vh" or "vw".',
      'console.warn: Vase UI: The panel "x" has the maxSize -1, which is not valid. The panel ignores this size. Use a number of 0 or more, or a string of such a number with an optional unit: "%", "px", "em", "rem", "vh" or "vw".',
    ]);
  });
});

describe('prop: rootResizeBehavior', () => {
  const fixedFirst = [
    { id: 'nav', defaultSize: 25, rootResizeBehavior: 'fixed' },
    { id: 'editor', defaultSize: 50 },
    { id: 'preview' },
  ];

  test('a fixed panel keeps its pixels at each size of the root, the others keep their ratio, and nothing is emitted', async () => {
    const log: unknown[] = [];
    const { width, resizeFrame } = await mountPanels(fixedFirst, {
      root: {
        onLayoutChange: () => log.push('change'),
        'onUpdate:modelValue': () => log.push('update'),
        onLayoutCommitted: () => log.push('commit'),
      },
    });
    expect([width(0), width(1), width(2)]).toEqual([
      expect.closeTo(100, 0),
      expect.closeTo(200, 0),
      expect.closeTo(100, 0),
    ]);
    await resizeFrame(300);
    expect([width(0), width(1), width(2)]).toEqual([
      expect.closeTo(100, 0),
      expect.closeTo(133.3, 0),
      expect.closeTo(66.7, 0),
    ]);
    expect(log).toEqual([]);
  });

  test('a proportional panel scales with the root', async () => {
    const { width, resizeFrame } = await mountPanels([{ defaultSize: 25 }, {}]);
    await resizeFrame(200);
    expect(width(0)).toBeCloseTo(50, 0);
  });

  test.each([
    { name: 'a drag', act: (at: (key: string) => HTMLElement) => drag(at('h1'), 40) },
    {
      name: 'a key',
      act: (at: (key: string) => HTMLElement) => key(at('h1'), '{Shift>}{ArrowRight}{/Shift}'),
    },
  ])('gives the fixed panel new pixels: $name', async ({ act }) => {
    const { at, width, resizeFrame } = await mountPanels(fixedFirst);
    await act(at);
    expect(width(0)).toBeCloseTo(140, 0);
    await resizeFrame(300);
    expect(width(0)).toBeCloseTo(140, 0);
  });

  test('v-model: the layout has the pixels of the fixed panel, and gives them again at another size of the root', async () => {
    const log: ResizableLayout[] = [];
    const root = model(log);
    const { at, width, spec, resizeFrame } = await mountPanels(fixedFirst, { root });
    await drag(at('h1'), 40);
    expect(log.at(-1)).toEqual({ nav: '140px', editor: 40, preview: 25 });
    await resizeFrame(300);
    root.modelValue = { ...(log.at(-1) as ResizableLayout) };
    await nextTick();
    expect(width(0)).toBeCloseTo(140, 0);
    expect(spec.frame).toContain('300px');
    // The panels with a number share the rest in the ratio of their numbers.
    expect(width(1)).toBeCloseTo(160 * (40 / 65), 0);
  });

  // The pixels come from the size in percent, which has three decimals.
  test('a key step of less than half a pixel moves a fixed panel', async () => {
    const log: ResizableLayout[] = [];
    const root = model(log);
    root.step = '0.375px';
    const { at } = await mountPanels(fixedFirst, { root });
    await key(at('h1'), '{ArrowRight}');
    expect(log.at(-1)).toEqual(expect.objectContaining({ nav: '100.376px' }));
    await key(at('h1'), '{ArrowRight}');
    expect(log.at(-1)).toEqual(expect.objectContaining({ nav: '100.752px' }));
  });

  test('a layout of the app gives a fixed panel new pixels, in percent or in pixels; the same entries give none', async () => {
    const root = reactive<Record<string, unknown>>({
      modelValue: { nav: 25, editor: 50, preview: 25 },
    });
    const { width, resizeFrame } = await mountPanels(
      [{ id: 'nav', rootResizeBehavior: 'fixed' }, { id: 'editor' }, { id: 'preview' }],
      { root },
    );
    root.modelValue = { nav: 30, editor: 40, preview: 30 };
    await nextTick();
    expect(width(0)).toBeCloseTo(120, 0);
    root.modelValue = { nav: '80px', editor: 40, preview: 30 };
    await nextTick();
    expect(width(0)).toBeCloseTo(80, 0);
    await resizeFrame(300);
    root.modelValue = { nav: '80px', editor: 40, preview: 30 };
    await nextTick();
    expect(width(0)).toBeCloseTo(80, 0);
    expect(width(1)).toBeCloseTo(220 * (40 / 70), 0);
  });

  test('a new object with the entries in percent that the root has gives the fixed panel no new pixels', async () => {
    const root = reactive<Record<string, unknown>>({
      modelValue: { nav: 25, editor: 50, preview: 25 },
    });
    const { width, resizeFrame } = await mountPanels(
      [{ id: 'nav', rootResizeBehavior: 'fixed' }, { id: 'editor' }, { id: 'preview' }],
      { root },
    );
    await resizeFrame(300);
    expect(width(0)).toBeCloseTo(100, 0);
    // A template gives a new object at each render of the parent.
    root.modelValue = { nav: 25, editor: 50, preview: 25 };
    await nextTick();
    expect(width(0)).toBeCloseTo(100, 0);
  });

  test('a fixed panel that mounts later, and a panel that becomes fixed, take their pixels', async () => {
    const { spec, width, resizeFrame } = await mountPanels([
      { id: 'a', defaultSize: 25 },
      { id: 'b' },
    ]);
    spec.parts[0]!.attrs = { id: 'a', defaultSize: 25, rootResizeBehavior: 'fixed' };
    spec.parts.push(
      { kind: 'handle', key: 'h2' },
      {
        kind: 'panel',
        key: 'p2',
        attrs: { id: 'late', defaultSize: 25, rootResizeBehavior: 'fixed' },
      },
    );
    await settle();
    const late = width(2);
    await resizeFrame(300);
    expect(width(0)).toBeCloseTo(100 * (300 / 400) + 25, -1);
    expect(width(2)).toBeCloseTo(late, 0);
  });

  test('the fixed panel with the greater priority gives way first, else the first one', async () => {
    const panels = (priority: number) => [
      { id: 'nav', defaultSize: 30, minSize: 10, rootResizeBehavior: 'fixed' },
      { id: 'editor', defaultSize: 40, minSize: 40 },
      {
        id: 'aside',
        defaultSize: 30,
        minSize: 10,
        rootResizeBehavior: 'fixed',
        rootResizePriority: priority,
      },
    ];
    // The two pins of 120 px are 37.5% each at 320 px, and the editor has 40% at the least.
    const prioritized = await mountPanels(panels(1));
    await prioritized.resizeFrame(320);
    expect([prioritized.width(0), prioritized.width(1), prioritized.width(2)]).toEqual([
      expect.closeTo(120, 0),
      expect.closeTo(128, 0),
      expect.closeTo(72, 0),
    ]);
    const plain = await mountPanels(panels(0));
    await plain.resizeFrame(320);
    expect([plain.width(0), plain.width(2)]).toEqual([
      expect.closeTo(72, 0),
      expect.closeTo(120, 0),
    ]);
  });
});

describe('prop: snapPoints', () => {
  // The panel starts at 50%: 200 px.
  test.each([
    { name: 'from above', snapPoints: [40], distance: -32, size: '40' },
    { name: 'from below', snapPoints: [40], distance: -48, size: '40' },
    { name: 'outside the tolerance', snapPoints: [40], distance: -52, size: '37' },
    { name: 'in pixels', snapPoints: ['160px'], distance: -36, size: '40' },
    { name: 'one of two', snapPoints: [20, 40], distance: -36, size: '40' },
  ])(
    'a drag snaps to a point within the tolerance: $name',
    async ({ snapPoints, distance, size }) => {
      const { at, flex } = await mountPanels([
        { defaultSize: 50, snapPoints, snapTolerance: '2%' },
        {},
      ]);
      await drag(at('h1'), distance);
      expect(flex(0)).toEqual([size]);
    },
  );

  test('the tolerance is 10 px by default, and snapTolerance gives another', async () => {
    const plain = await mountPanels([{ defaultSize: 50, snapPoints: [40] }, {}]);
    await drag(plain.at('h1'), -49);
    expect(plain.flex(0)).toEqual(['40']);
    await drag(plain.at('h1'), 52);
    expect(plain.flex(0)).toEqual(['53']);
    const wide = await mountPanels([
      { defaultSize: 50, snapPoints: [40], snapTolerance: '20px' },
      {},
    ]);
    await drag(wide.at('h1'), -58);
    expect(wide.flex(0)).toEqual(['40']);
  });

  test('the panel after the handle snaps too; a key does not snap', async () => {
    const after = await mountPanels([{}, { defaultSize: 50, snapPoints: [40], snapTolerance: 2 }]);
    await drag(after.at('h1'), 36);
    expect(after.flex(1)).toEqual(['40']);
    const keys = await mountPanels([{ defaultSize: 45, snapPoints: [40], snapTolerance: 10 }, {}]);
    await key(keys.at('h1'), '{ArrowLeft}');
    expect(keys.flex(0)).toEqual(['44']);
  });
});
