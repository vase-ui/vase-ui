import { describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick, shallowRef } from 'vue';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  screen,
  takeReportedMessages,
} from '#test-utils';
import { REASONS } from '../../internals/reasons';
import * as Resizable from '../index.parts';

describe('<Resizable.Panel />', () => {
  const { render } = createRenderer();

  // The container is 1000 px wide and 400 px high, and a handle has no size.
  // A function renders the parts, so that a panel can have a template ref.
  function renderPanels(options: {
    root?: Record<string, unknown>;
    panels: Record<string, unknown>[];
  }) {
    return render(() => (
      <div style={{ width: '1000px', height: '400px' }}>
        <Resizable.Root style={{ height: '100%' }} {...options.root}>
          {options.panels.flatMap((panel, index) => [
            index > 0 ? (
              <Resizable.Handle key={`handle-${index}`} data-testid={`handle-${index}`} />
            ) : null,
            <Resizable.Panel key={`panel-${index}`} data-testid={`panel-${index}`} {...panel} />,
          ])}
        </Resizable.Root>
      </div>
    ));
  }

  async function drag(handle: HTMLElement, distance: number) {
    const pointer = { pointerId: 1, pointerType: 'mouse', buttons: 1 };
    await fireEvent.pointerDown(handle, { ...pointer, clientX: 0 });
    await fireEvent.pointerMove(handle, { ...pointer, clientX: distance });
    await fireEvent.pointerUp(handle, { pointerId: 1, pointerType: 'mouse', clientX: distance });
  }

  const flexOf = (index: number) => screen.getByTestId(`panel-${index}`).style.flexGrow;

  describeConformance(<Resizable.Panel />, () => ({
    render: (node) => render(<Resizable.Root>{node}</Resizable.Root>),
    refInstanceof: window.HTMLDivElement,
  }));

  describe('prop: id', () => {
    it('is the id of the element, and the key of the layout', async () => {
      const onLayoutChange = vi.fn();
      await renderPanels({
        root: { onLayoutChange },
        panels: [{ id: 'sidebar' }, { id: 'content' }],
      });

      expect(screen.getByTestId('panel-0')).toHaveAttribute('id', 'sidebar');
      await drag(screen.getByTestId('handle-1'), 100);

      expect(onLayoutChange).toHaveBeenCalledWith({ sidebar: 60, content: 40 }, expect.anything());
    });

    it('is a generated id with no id prop, and the handle controls it', async () => {
      await renderPanels({ panels: [{}, {}] });
      const id = screen.getByTestId('panel-0').id;

      expect(id).not.toBe('');
      expect(id).not.toBe(screen.getByTestId('panel-1').id);
      expect(screen.getByTestId('handle-1')).toHaveAttribute('aria-controls', id);
    });

    it('warns once when two panels have one id', async () => {
      await renderPanels({ panels: [{ id: 'same' }, { id: 'same' }] });

      expect(takeReportedMessages()).toEqual([
        expect.stringMatching(
          /^console\.warn: Vase UI: Two panels of one root have the id "same"\./,
        ),
      ]);
    });
  });

  describe('style', () => {
    it('grows by its size in percent, from a basis of zero', async () => {
      await renderPanels({ panels: [{ defaultSize: 30 }, {}, {}] });

      for (const index of [0, 1, 2]) {
        const panel = screen.getByTestId(`panel-${index}`);
        expect(panel.style.flexShrink).toBe('1');
        expect(panel.style.flexBasis).toBe('0px');
      }
      expect([flexOf(0), flexOf(1), flexOf(2)]).toEqual(['30', '35', '35']);
    });

    it.each([
      { name: 'horizontal', orientation: 'horizontal', set: 'minWidth', unset: 'minHeight' },
      { name: 'vertical', orientation: 'vertical', set: 'minHeight', unset: 'minWidth' },
    ] as const)(
      'has no minimum size on the axis of a $name root',
      async ({ orientation, set, unset }) => {
        await renderPanels({ root: { orientation }, panels: [{}, {}] });
        const panel = screen.getByTestId('panel-0');

        expect(panel.style[set]).toBe('0px');
        expect(panel.style[unset]).toBe('');
      },
    );

    it('has the size in percent as a variable with no unit', async () => {
      await renderPanels({ panels: [{ defaultSize: 30 }, {}] });

      expect(screen.getByTestId('panel-0').style.getPropertyValue('--resizable-panel-size')).toBe(
        '30',
      );
      await drag(screen.getByTestId('handle-1'), 100);

      expect(screen.getByTestId('panel-0').style.getPropertyValue('--resizable-panel-size')).toBe(
        '40',
      );
      expect(screen.getByTestId('panel-1').style.getPropertyValue('--resizable-panel-size')).toBe(
        '60',
      );
    });

    it('keeps the style of a consumer, which wins over the style of the panel', async () => {
      await renderPanels({ panels: [{ style: { flex: '1 1 auto', color: 'red' } }, {}] });
      const panel = screen.getByTestId('panel-0');

      expect(panel.style.flexBasis).toBe('auto');
      expect(panel.style.color).toBe('red');
    });

    it('has no data-allow-mismatch after the mount', async () => {
      await renderPanels({ panels: [{}, {}] });

      expect(screen.getByTestId('panel-0')).not.toHaveAttribute('data-allow-mismatch');
    });

    it('fills the root by its size', async () => {
      await renderPanels({ panels: [{ defaultSize: 25 }, {}] });

      expect(screen.getByTestId('panel-0').getBoundingClientRect().width).toBeCloseTo(250, 0);
      expect(screen.getByTestId('panel-1').getBoundingClientRect().width).toBeCloseTo(750, 0);
    });
  });

  describe('prop: defaultSize', () => {
    it.each([
      { name: 'a number', defaultSize: 30 },
      { name: 'a string of a number', defaultSize: '30' },
      { name: 'a string with a percent sign', defaultSize: '30%' },
    ])('is the size at the start, as $name', async ({ defaultSize }) => {
      await renderPanels({ panels: [{ defaultSize }, {}] });

      expect([flexOf(0), flexOf(1)]).toEqual(['30', '70']);
    });

    it('does not win over the layout of the root', async () => {
      await renderPanels({
        root: { defaultLayout: { a: 60, b: 40 } },
        panels: [{ id: 'a', defaultSize: 30 }, { id: 'b' }],
      });

      expect([flexOf(0), flexOf(1)]).toEqual(['60', '40']);
    });

    it('has no effect after the mount', async () => {
      const defaultSize = shallowRef(30);
      await render(() => (
        <div style={{ width: '1000px' }}>
          <Resizable.Root>
            <Resizable.Panel id="a" data-testid="a" defaultSize={defaultSize.value} />
            <Resizable.Panel id="b" data-testid="b" />
          </Resizable.Root>
        </div>
      ));

      defaultSize.value = 80;
      await nextTick();

      expect(screen.getByTestId('a').style.flexGrow).toBe('30');
      expect(screen.getByTestId('b').style.flexGrow).toBe('70');
    });

    it('takes the remainder in equal parts for the panels with no size', async () => {
      await renderPanels({ panels: [{ defaultSize: 40 }, {}, {}] });

      expect([flexOf(0), flexOf(1), flexOf(2)]).toEqual(['40', '30', '30']);
    });
  });

  describe('prop: minSize and maxSize', () => {
    it('hold in a drag', async () => {
      await renderPanels({
        panels: [
          { id: 'a', maxSize: 70 },
          { id: 'b', minSize: 20 },
        ],
      });

      await drag(screen.getByTestId('handle-1'), 500);
      expect([flexOf(0), flexOf(1)]).toEqual(['70', '30']);
      await drag(screen.getByTestId('handle-1'), -900);
      expect([flexOf(0), flexOf(1)]).toEqual(['0', '100']);
    });

    it('hold in a key move', async () => {
      const { user } = await renderPanels({
        panels: [
          { id: 'a', minSize: 30 },
          { id: 'b', minSize: 30, maxSize: 60 },
        ],
      });
      const handle = screen.getByTestId('handle-1');
      handle.focus();

      await user.keyboard('{End}');
      expect([flexOf(0), flexOf(1)]).toEqual(['70', '30']);
      await user.keyboard('{Home}');
      expect([flexOf(0), flexOf(1)]).toEqual(['40', '60']);
    });

    it.each([
      { name: 'a string of a number', minSize: '25', maxSize: '75' },
      { name: 'a string with a percent sign', minSize: '25%', maxSize: '75%' },
    ])('take $name', async ({ minSize, maxSize }) => {
      const { user } = await renderPanels({ panels: [{ minSize, maxSize }, {}] });
      const handle = screen.getByTestId('handle-1');
      handle.focus();

      await user.keyboard('{End}');
      expect(flexOf(0)).toBe('75');
      await user.keyboard('{Home}');
      expect(flexOf(0)).toBe('25');
    });

    it.each([
      { name: 'minimum', prop: 'minSize', from: 0, to: 70, first: '70', second: '30' },
      { name: 'maximum', prop: 'maxSize', from: 100, to: 20, first: '20', second: '80' },
    ])(
      'moves the layout inside a new $name with no change event',
      async ({ prop, from, to, first, second }) => {
        const size = shallowRef(from);
        const onLayoutChange = vi.fn();
        await render(() => (
          <div style={{ width: '1000px' }}>
            <Resizable.Root onLayoutChange={onLayoutChange}>
              <Resizable.Panel id="a" data-testid="a" {...{ [prop]: size.value }} />
              <Resizable.Panel id="b" data-testid="b" />
            </Resizable.Root>
          </div>
        ));
        expect(screen.getByTestId('a').style.flexGrow).toBe('50');

        size.value = to;
        await nextTick();

        expect(screen.getByTestId('a').style.flexGrow).toBe(first);
        expect(screen.getByTestId('b').style.flexGrow).toBe(second);
        expect(onLayoutChange).not.toHaveBeenCalled();
      },
    );

    it('warns once when the sizes cannot sum to 100', async () => {
      await renderPanels({
        panels: [{ maxSize: 40 }, { maxSize: 40 }],
      });

      expect(takeReportedMessages()).toEqual([
        expect.stringMatching(
          /^console\.warn: Vase UI: The sizes of the panels cannot sum to 100\./,
        ),
      ]);
    });
  });

  describe('padding and border', () => {
    // The size of a panel is a share of the room that the panels share, which is the sum of their
    // content boxes. A panel adds its padding and border to that share.
    it.each([
      { name: 'horizontal', orientation: 'horizontal', axis: 'clientX' },
      { name: 'vertical', orientation: 'vertical', axis: 'clientY' },
    ] as const)(
      'keeps the handle under the pointer when the panels of a $name root have padding and a border',
      async ({ orientation, axis }) => {
        await renderPanels({
          root: { orientation },
          panels: [
            { style: { padding: '20px', border: '5px solid' } },
            { style: { padding: '10px 0 0 10px' } },
          ],
        });
        const content = (index: number) => {
          const panel = screen.getByTestId(`panel-${index}`);
          const rect = panel.getBoundingClientRect();
          const style = getComputedStyle(panel);
          return orientation === 'horizontal'
            ? rect.width -
                [
                  style.paddingLeft,
                  style.paddingRight,
                  style.borderLeftWidth,
                  style.borderRightWidth,
                ]
                  .map(Number.parseFloat)
                  .reduce((total, edge) => total + edge, 0)
            : rect.height -
                [
                  style.paddingTop,
                  style.paddingBottom,
                  style.borderTopWidth,
                  style.borderBottomWidth,
                ]
                  .map(Number.parseFloat)
                  .reduce((total, edge) => total + edge, 0);
        };
        const first = content(0);
        const second = content(1);
        const handle = screen.getByTestId('handle-1');
        const pointer = { pointerId: 1, pointerType: 'mouse' };

        await fireEvent.pointerDown(handle, { ...pointer, [axis]: 0, buttons: 1 });
        await fireEvent.pointerMove(handle, { ...pointer, [axis]: 60, buttons: 1 });
        await fireEvent.pointerUp(handle, { ...pointer, [axis]: 60 });

        expect(content(0) - first).toBeCloseTo(60, 0);
        expect(second - content(1)).toBeCloseTo(60, 0);
      },
    );
  });

  describe('state', () => {
    it('gives the orientation and the size to the slot and to stateClass', async () => {
      await renderPanels({
        root: { orientation: 'vertical' },
        panels: [
          {
            defaultSize: 30,
            stateClass: (state: { orientation: string; size: number }) =>
              `${state.orientation}-${state.size}`,
          },
          {},
        ],
      });
      const panel = screen.getByTestId('panel-0');

      expect(panel).toHaveClass('vertical-30');
      expect(panel).toHaveAttribute('data-orientation', 'vertical');
      expect(panel).not.toHaveAttribute('data-size');
    });

    it('gives the size to the default slot', async () => {
      await render(
        <Resizable.Root>
          <Resizable.Panel data-testid="panel" defaultSize={30}>
            {{ default: ({ state }: { state: { size: number } }) => `size ${state.size}` }}
          </Resizable.Panel>
          <Resizable.Panel />
        </Resizable.Root>,
      );

      expect(screen.getByTestId('panel')).toHaveTextContent('size 30');
    });
  });

  describe('prop: collapsible', () => {
    // The container is 1000 px wide, so 10 px are 1%. The first panel has a least size of 20 and a
    // collapsed size of 0, so the middle of the distance is 10.
    const collapsible = { id: 'a', collapsible: true, minSize: 20 };

    it('has data-collapsed and the state collapsed while the panel is collapsed', async () => {
      await renderPanels({
        panels: [
          {
            ...collapsible,
            defaultSize: 40,
            stateClass: (state: { collapsed: boolean }) => `collapsed-${state.collapsed}`,
          },
          {},
        ],
      });
      const panel = screen.getByTestId('panel-0');
      expect(panel).not.toHaveAttribute('data-collapsed');
      expect(panel).toHaveClass('collapsed-false');

      await drag(screen.getByTestId('handle-1'), -310);
      expect(panel).toHaveAttribute('data-collapsed');
      expect(panel).toHaveClass('collapsed-true');

      await drag(screen.getByTestId('handle-1'), 110);
      expect(panel).not.toHaveAttribute('data-collapsed');
    });

    it.each([
      {
        name: 'stops at the least size above the middle',
        defaultSize: 40,
        distance: -250,
        expected: ['20', '80'],
      },
      {
        name: 'collapses below the middle',
        defaultSize: 40,
        distance: -310,
        expected: ['0', '100'],
      },
      {
        name: 'stays collapsed below the middle',
        defaultSize: 0,
        distance: 90,
        expected: ['0', '100'],
      },
      { name: 'expands above the middle', defaultSize: 0, distance: 110, expected: ['20', '80'] },
      {
        name: 'goes on past the least size',
        defaultSize: 0,
        distance: 300,
        expected: ['30', '70'],
      },
    ])('a drag $name of the distance', async ({ defaultSize, distance, expected }) => {
      await renderPanels({ panels: [{ ...collapsible, defaultSize }, {}] });

      await drag(screen.getByTestId('handle-1'), distance);

      expect([flexOf(0), flexOf(1)]).toEqual(expected);
    });

    it('has a collapsed size that the panel keeps while it is collapsed', async () => {
      await renderPanels({ panels: [{ ...collapsible, collapsedSize: 4, defaultSize: 40 }, {}] });

      await drag(screen.getByTestId('handle-1'), -400);
      expect([flexOf(0), flexOf(1)]).toEqual(['4', '96']);
      expect(screen.getByTestId('panel-0')).toHaveAttribute('data-collapsed');
    });

    it('gives a collapsed panel the first size when its default size is the collapsed size', async () => {
      const onCollapsedChange = vi.fn();
      await renderPanels({
        panels: [{ ...collapsible, collapsedSize: 4, defaultSize: 4, onCollapsedChange }, {}],
      });

      expect([flexOf(0), flexOf(1)]).toEqual(['4', '96']);
      expect(screen.getByTestId('panel-0')).toHaveAttribute('data-collapsed');
      expect(onCollapsedChange).not.toHaveBeenCalled();
    });

    it('emits collapsedChange when the panel collapses or expands, and not for another change', async () => {
      const onCollapsedChange = vi.fn();
      await renderPanels({
        panels: [{ ...collapsible, defaultSize: 40, onCollapsedChange }, {}],
      });
      const handle = screen.getByTestId('handle-1');
      expect(onCollapsedChange).not.toHaveBeenCalled();

      await drag(handle, -100);
      expect(onCollapsedChange).not.toHaveBeenCalled();

      await drag(handle, -310);
      expect(onCollapsedChange.mock.calls).toEqual([[true]]);

      await drag(handle, 30);
      expect(onCollapsedChange.mock.calls).toEqual([[true]]);

      await drag(handle, 110);
      expect(onCollapsedChange.mock.calls).toEqual([[true], [false]]);
    });

    it('emits collapsedChange when a change of the layout of the app collapses the panel', async () => {
      const layout = shallowRef<Record<string, number>>({ a: 40, b: 60 });
      const onCollapsedChange = vi.fn();
      await render(() => (
        <div style={{ width: '1000px' }}>
          <Resizable.Root layout={layout.value}>
            <Resizable.Panel {...collapsible} onCollapsedChange={onCollapsedChange} />
            <Resizable.Panel id="b" />
          </Resizable.Root>
        </div>
      ));
      expect(onCollapsedChange).not.toHaveBeenCalled();

      layout.value = { a: 0, b: 100 };
      await nextTick();

      expect(onCollapsedChange.mock.calls).toEqual([[true]]);
    });

    it('warns once when a collapsible panel has no size that is a collapse', async () => {
      await renderPanels({ panels: [{ id: 'a', collapsible: true }, {}] });

      expect(takeReportedMessages()).toEqual([
        expect.stringMatching(
          /^console\.warn: Vase UI: The panel "a" is collapsible, and its `minSize` is not greater than its `collapsedSize`\./,
        ),
      ]);
    });
  });

  describe('prop: collapseThreshold', () => {
    // The least size is 20 and the collapsed size is 0, so a threshold of 5 collapses a panel below 15
    // and expands it above 5.
    const collapsible = { id: 'a', collapsible: true, minSize: 20 };

    it.each([
      {
        name: 'a number collapses below 15',
        collapseThreshold: 5,
        defaultSize: 40,
        distance: -260,
        expected: ['0', '100'],
      },
      {
        name: 'a number stops at 16',
        collapseThreshold: 5,
        defaultSize: 40,
        distance: -240,
        expected: ['20', '80'],
      },
      {
        name: 'a percent string collapses below 15',
        collapseThreshold: '5%',
        defaultSize: 40,
        distance: -260,
        expected: ['0', '100'],
      },
      {
        name: 'a string of a number stops at 16',
        collapseThreshold: '5',
        defaultSize: 40,
        distance: -240,
        expected: ['20', '80'],
      },
      {
        name: 'a number expands above 5',
        collapseThreshold: 5,
        defaultSize: 0,
        distance: 60,
        expected: ['20', '80'],
      },
      {
        name: 'a number stays collapsed at 4',
        collapseThreshold: 5,
        defaultSize: 0,
        distance: 40,
        expected: ['0', '100'],
      },
    ])(
      'is the distance from the limits for $name',
      async ({ collapseThreshold, defaultSize, distance, expected }) => {
        await renderPanels({ panels: [{ ...collapsible, collapseThreshold, defaultSize }, {}] });

        await drag(screen.getByTestId('handle-1'), distance);

        expect([flexOf(0), flexOf(1)]).toEqual(expected);
      },
    );
  });

  describe('methods', () => {
    type PanelInstance = InstanceType<typeof Resizable.Panel>;
    const instances: Record<string, PanelInstance> = {};
    const withRef = (id: string) => ({
      id,
      ref: (value: unknown) => {
        instances[id] = value as PanelInstance;
      },
    });
    const collapsible = { ...withRef('a'), collapsible: true, minSize: 20 };

    it('collapses with collapse() and gives back the size from before with expand()', async () => {
      await renderPanels({ panels: [{ ...collapsible, defaultSize: 40 }, withRef('b')] });
      expect(instances.a.isCollapsed()).toBe(false);

      instances.a.collapse();
      await nextTick();
      expect([flexOf(0), flexOf(1)]).toEqual(['0', '100']);
      expect(instances.a.isCollapsed()).toBe(true);

      instances.a.expand();
      await nextTick();
      expect([flexOf(0), flexOf(1)]).toEqual(['40', '60']);
      expect(instances.a.isCollapsed()).toBe(false);
    });

    it.each([
      { name: 'in one move', distances: [-400], expected: ['40', '60'] },
      { name: 'in two moves', distances: [-250, -400], expected: ['20', '80'] },
    ])(
      'gives back the size before the change that collapsed it with expand(), after a drag $name',
      async ({ distances, expected }) => {
        await renderPanels({ panels: [{ ...collapsible, defaultSize: 40 }, withRef('b')] });
        const handle = screen.getByTestId('handle-1');
        const pointer = { pointerId: 1, pointerType: 'mouse', buttons: 1 };

        await fireEvent.pointerDown(handle, { ...pointer, clientX: 0 });
        for (const distance of distances) {
          await fireEvent.pointerMove(handle, { ...pointer, clientX: distance });
        }
        await fireEvent.pointerUp(handle, { pointerId: 1, pointerType: 'mouse' });
        expect([flexOf(0), flexOf(1)]).toEqual(['0', '100']);
        instances.a.expand();
        await nextTick();

        expect([flexOf(0), flexOf(1)]).toEqual(expected);
      },
    );

    it('gives the least size with expand() when the panel has no size from before', async () => {
      await renderPanels({ panels: [{ ...collapsible, defaultSize: 0 }, withRef('b')] });

      instances.a.expand();
      await nextTick();

      expect([flexOf(0), flexOf(1)]).toEqual(['20', '80']);
    });

    it.each([
      { name: 'a number', size: 30, expected: ['30', '70'] },
      { name: 'a string of a number', size: '30', expected: ['30', '70'] },
      { name: 'a string with a percent sign', size: '30%', expected: ['30', '70'] },
      { name: 'a size below the least size', size: 5, expected: ['0', '100'] },
    ])('gives the panel $name with resize()', async ({ size, expected }) => {
      await renderPanels({ panels: [{ ...collapsible, defaultSize: 40 }, withRef('b')] });

      instances.a.resize(size);
      await nextTick();

      expect([flexOf(0), flexOf(1)]).toEqual(expected);
    });

    it('takes the room above the least sizes of the other panels with expand()', async () => {
      await renderPanels({
        root: { defaultLayout: { nav: 0, editor: 35, preview: 65 } },
        panels: [
          { ...withRef('nav'), collapsible: true, minSize: 40 },
          { ...withRef('editor'), minSize: 30 },
          { ...withRef('preview'), collapsible: true, minSize: 20 },
        ],
      });

      instances.nav.expand();
      await nextTick();

      expect([flexOf(0), flexOf(1), flexOf(2)]).toEqual(['40', '30', '30']);
      expect(instances.preview.isCollapsed()).toBe(false);
    });

    it('does not collapse another panel with expand(), also when that panel has the room', async () => {
      await renderPanels({
        root: { defaultLayout: { nav: 60, editor: 40, preview: 0 } },
        panels: [
          { ...withRef('nav'), collapsible: true, minSize: 20 },
          { ...withRef('editor'), minSize: 30 },
          { ...withRef('preview'), collapsible: true, minSize: 20 },
        ],
      });
      // The nav panel collapses from 60, and then the preview panel expands to its least size.
      instances.nav.collapse();
      await nextTick();
      instances.preview.expand();
      await nextTick();
      expect([flexOf(0), flexOf(1), flexOf(2)]).toEqual(['0', '80', '20']);

      instances.nav.expand();
      await nextTick();

      // The nav panel does not get its 60 back, because the preview panel would collapse for it.
      expect([flexOf(0), flexOf(1), flexOf(2)]).toEqual(['50', '30', '20']);
      expect(instances.preview.isCollapsed()).toBe(false);
    });

    it('takes only what another panel has above its least size with resize()', async () => {
      await renderPanels({
        root: { defaultLayout: { nav: 30, editor: 30, preview: 40 } },
        panels: [
          { ...withRef('nav'), collapsible: true, minSize: 20 },
          { ...withRef('editor'), minSize: 30 },
          { ...withRef('preview'), collapsible: true, minSize: 20 },
        ],
      });

      instances.editor.resize(70);
      await nextTick();

      expect([flexOf(0), flexOf(1), flexOf(2)]).toEqual(['30', '50', '20']);
    });

    it('collapses the last panel into the panel before it, and expands it again', async () => {
      await renderPanels({
        panels: [
          { ...withRef('a'), defaultSize: 60 },
          { ...withRef('b'), collapsible: true, minSize: 20, defaultSize: 40 },
        ],
      });

      instances.b.collapse();
      await nextTick();
      expect([flexOf(0), flexOf(1)]).toEqual(['100', '0']);

      instances.b.expand();
      await nextTick();
      expect([flexOf(0), flexOf(1)]).toEqual(['60', '40']);
    });

    it('emits the change and the commit with the reason imperative-action', async () => {
      const calls: string[] = [];
      const reasons: string[] = [];
      await renderPanels({
        root: {
          onLayoutChange: (_layout: unknown, details: { reason: string }) => {
            calls.push('layoutChange');
            reasons.push(details.reason);
          },
          'onUpdate:layout': () => {
            calls.push('update:layout');
          },
          onLayoutCommitted: (_layout: unknown, details: { reason: string }) => {
            calls.push('layoutCommitted');
            reasons.push(details.reason);
          },
        },
        panels: [{ ...collapsible, defaultSize: 40 }, withRef('b')],
      });

      instances.a.collapse();
      await nextTick();

      expect(calls).toEqual(['layoutChange', 'update:layout', 'layoutCommitted']);
      expect(reasons).toEqual([REASONS.imperativeAction, REASONS.imperativeAction]);
    });

    it('keeps the layout when a listener cancels the change of a method', async () => {
      const onCommitted = vi.fn();
      await renderPanels({
        root: {
          onLayoutChange: (_layout: unknown, details: { cancel: () => void }) => {
            details.cancel();
          },
          onLayoutCommitted: onCommitted,
        },
        panels: [{ ...collapsible, defaultSize: 40 }, withRef('b')],
      });

      instances.a.collapse();
      await nextTick();

      expect([flexOf(0), flexOf(1)]).toEqual(['40', '60']);
      expect(onCommitted).not.toHaveBeenCalled();
    });

    it.each([
      {
        name: 'collapse() when not collapsible',
        act: () => {
          instances.b.collapse();
        },
      },
      {
        name: 'collapse() when collapsed',
        act: () => {
          instances.c.collapse();
        },
      },
      {
        name: 'expand() when not collapsed',
        act: () => {
          instances.a.expand();
        },
      },
      {
        name: 'resize() to the same size',
        act: () => {
          instances.a.resize(40);
        },
      },
    ])('emits nothing for $name', async ({ act }) => {
      const onLayoutChange = vi.fn();
      await renderPanels({
        root: { onLayoutChange },
        panels: [
          { ...collapsible, defaultSize: 40 },
          { ...withRef('b'), defaultSize: 30 },
          { ...withRef('c'), collapsible: true, minSize: 20, defaultSize: 0 },
          withRef('d'),
        ],
      });

      act();
      await nextTick();

      expect(onLayoutChange).not.toHaveBeenCalled();
    });

    it('does nothing for a panel that is alone in its root', async () => {
      const onLayoutChange = vi.fn();
      await renderPanels({
        root: { onLayoutChange },
        panels: [{ ...collapsible, defaultSize: 100 }],
      });

      instances.a.collapse();
      instances.a.resize(50);
      await nextTick();

      expect(flexOf(0)).toBe('100');
      expect(onLayoutChange).not.toHaveBeenCalled();
    });

    it('works on a disabled panel and on a disabled root', async () => {
      await renderPanels({
        root: { disabled: true },
        panels: [{ ...collapsible, disabled: true, defaultSize: 40 }, withRef('b')],
      });

      instances.a.collapse();
      await nextTick();
      expect([flexOf(0), flexOf(1)]).toEqual(['0', '100']);

      instances.a.resize(30);
      await nextTick();
      expect([flexOf(0), flexOf(1)]).toEqual(['30', '70']);
    });
  });

  describe('prop: disabled', () => {
    const layout = { a: 30, b: 30, c: 40 };

    it('has data-disabled and the state disabled', async () => {
      await renderPanels({
        panels: [
          {
            id: 'a',
            disabled: true,
            stateClass: (state: { disabled: boolean }) => `disabled-${state.disabled}`,
          },
          { id: 'b' },
        ],
      });

      expect(screen.getByTestId('panel-0')).toHaveAttribute('data-disabled');
      expect(screen.getByTestId('panel-0')).toHaveClass('disabled-true');
      expect(screen.getByTestId('panel-1')).not.toHaveAttribute('data-disabled');
    });

    it.each([
      {
        name: 'before it to the right',
        handle: 'handle-1',
        distance: 100,
        expected: ['40', '30', '30'],
      },
      {
        name: 'before it to the left',
        handle: 'handle-1',
        distance: -100,
        expected: ['20', '30', '50'],
      },
      {
        name: 'after it to the right',
        handle: 'handle-2',
        distance: 100,
        expected: ['40', '30', '30'],
      },
      {
        name: 'after it to the left',
        handle: 'handle-2',
        distance: -100,
        expected: ['20', '30', '50'],
      },
    ])('goes through the panel for the handle $name', async ({ handle, distance, expected }) => {
      await renderPanels({
        root: { defaultLayout: layout },
        panels: [{ id: 'a' }, { id: 'b', disabled: true }, { id: 'c' }],
      });

      await drag(screen.getByTestId(handle), distance);

      expect([flexOf(0), flexOf(1), flexOf(2)]).toEqual(expected);
    });

    it('stops a key on a handle that has only disabled panels on one side', async () => {
      const onLayoutChange = vi.fn();
      const { user } = await renderPanels({
        root: { defaultLayout: { a: 50, b: 50 }, onLayoutChange },
        panels: [{ id: 'a', disabled: true }, { id: 'b' }],
      });
      const handle = screen.getByTestId('handle-1');
      handle.focus();

      await user.keyboard('{ArrowRight}{ArrowLeft}{Home}{End}');

      expect(onLayoutChange).not.toHaveBeenCalled();
      expect(handle).toHaveAttribute('aria-valuemin', '50');
      expect(handle).toHaveAttribute('aria-valuemax', '50');
    });

    it('leaves Enter and a double click on a handle whose primary panel is disabled', async () => {
      const onLayoutChange = vi.fn();
      await renderPanels({
        root: { defaultLayout: { a: 40, b: 60 }, onLayoutChange },
        panels: [{ id: 'a', collapsible: true, minSize: 20, disabled: true }, { id: 'b' }],
      });
      const handle = screen.getByTestId('handle-1');
      handle.focus();

      expect(await fireEvent.keyDown(handle, { key: 'Enter' })).toBe(true);
      expect(await fireEvent.dblClick(handle)).toBe(true);

      expect(onLayoutChange).not.toHaveBeenCalled();
    });
  });

  describe('useParentPanel()', () => {
    const Probe = defineComponent({
      props: { name: { type: String, required: true } },
      setup(props) {
        const parent = Resizable.useParentPanel();
        return () => (
          <button
            type="button"
            data-testid={props.name}
            data-id={parent?.id.value}
            data-collapsed={parent ? String(parent.state.value.collapsed) : 'none'}
            onClick={() => {
              parent?.collapse();
            }}
          >
            {parent ? `${parent.state.value.size} ${String(parent.isCollapsed())}` : 'none'}
          </button>
        );
      },
    });

    it('gives the id, the state and the methods of the panel that the part is in', async () => {
      await render(
        <div style={{ width: '1000px', height: '400px' }}>
          <Resizable.Root>
            <Resizable.Panel id="a" data-testid="panel-0" collapsible minSize={20} defaultSize={40}>
              <Probe name="probe" />
            </Resizable.Panel>
            <Resizable.Handle data-testid="handle-1" />
            <Resizable.Panel id="b" data-testid="panel-1" />
          </Resizable.Root>
        </div>,
      );
      const probe = screen.getByTestId('probe');
      expect(probe).toHaveAttribute('data-id', 'a');
      expect(probe).toHaveTextContent('40 false');

      await fireEvent.click(probe);
      expect(probe).toHaveAttribute('data-collapsed', 'true');
      expect(probe).toHaveTextContent('0 true');
      expect([flexOf(0), flexOf(1)]).toEqual(['0', '100']);

      await drag(screen.getByTestId('handle-1'), 110);
      expect(probe).toHaveAttribute('data-collapsed', 'false');
    });

    it('gives the panel that is nearest to the part when roots are nested', async () => {
      await render(
        <div style={{ width: '1000px', height: '400px' }}>
          <Resizable.Root style={{ height: '100%' }}>
            <Resizable.Panel id="outer">
              <Resizable.Root orientation="vertical" style={{ height: '100%' }}>
                <Resizable.Panel id="inner" defaultSize={30}>
                  <Probe name="probe" />
                </Resizable.Panel>
                <Resizable.Handle />
                <Resizable.Panel id="other" />
              </Resizable.Root>
            </Resizable.Panel>
          </Resizable.Root>
        </div>,
      );

      expect(screen.getByTestId('probe')).toHaveAttribute('data-id', 'inner');
      expect(screen.getByTestId('probe')).toHaveTextContent('30 false');
    });

    it('gives null outside a panel', async () => {
      await render(
        <div>
          <Probe name="outside" />
          <Resizable.Root>
            <Probe name="in-root" />
            <Resizable.Panel />
          </Resizable.Root>
        </div>,
      );

      expect(screen.getByTestId('in-root')).toHaveTextContent('none');
      expect(screen.getByTestId('outside')).toHaveTextContent('none');
    });
  });

  // This case is the last one of the file. In Vue 3.5.12, an error that a render throws leaves
  // the current instance set, and each later case of the file then gets a warning.
  it('throws a descriptive error for a size that is not valid', async () => {
    await expect(
      render(
        <Resizable.Root>
          <Resizable.Panel minSize="12ch" />
          <Resizable.Panel />
        </Resizable.Root>,
      ),
    ).rejects.toThrow(/^Vase UI: The size "12ch" is not valid\./);

    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of render function'),
    ]);
  });
});
