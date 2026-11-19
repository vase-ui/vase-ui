import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { KeepAlive, defineComponent, nextTick, shallowRef } from 'vue';
import type { ShallowRef } from 'vue';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  isVaporParts,
  removedPartHydrationTests,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
  waitSingleFrame,
} from '#test-utils';
import { isVueMinor } from '../../../test/vaporParts/isVueMinor';
import { REASONS } from '../../internals/reasons';
import { Resizable } from '@vase-ui/vue/resizable';
import ResizableRootHydration from '../root/ResizableRootHydration.test.vue';

describe('<Resizable.Panel />', () => {
  const { render } = createRenderer();

  // The container is 1000 px wide and 400 px high, and a handle has no size. A test can give the
  // width as a ref and change it.
  // A function renders the parts, so that a panel can have a template ref.
  function renderPanels(options: {
    root?: Record<string, unknown>;
    panels: Record<string, unknown>[];
    width?: ShallowRef<number>;
    renderFirstPanel?: InstanceType<typeof Resizable.Panel>['$slots']['render'];
  }) {
    return render(() => (
      <div style={{ width: `${options.width?.value ?? 1000}px`, height: '400px' }}>
        <Resizable.Root style={{ height: '100%' }} {...options.root}>
          {() =>
            options.panels.flatMap((panel, index) => [
              index > 0 ? (
                <Resizable.Handle key={`handle-${index}`} data-testid={`handle-${index}`} />
              ) : null,
              <Resizable.Panel
                key={`panel-${index}`}
                data-testid={`panel-${index}`}
                {...panel}
                v-slots={
                  index === 0 && options.renderFirstPanel
                    ? { render: options.renderFirstPanel }
                    : undefined
                }
              />,
            ])
          }
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
  const widthOf = (index: number) =>
    screen.getByTestId(`panel-${index}`).getBoundingClientRect().width;

  // The `ResizeObserver` of the root reads the new width after the layout of the next frame. A
  // second frame comes after that read, so the panels then have their sizes for the new width. Until
  // then they have the sizes of the old width.
  async function changeWidth(width: ShallowRef<number>, next: number) {
    await flushMicrotasks();
    width.value = next;
    await nextTick();
    await waitSingleFrame();
    await waitSingleFrame();
  }

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

    it('keeps the handle under the pointer in a root that a transform scales', async () => {
      await render(
        <div style={{ width: '1000px', transform: 'scale(0.5)', transformOrigin: '0 0' }}>
          <Resizable.Root>
            <Resizable.Panel style={{ padding: '0 100px' }} />
            <Resizable.Handle data-testid="handle" />
            <Resizable.Panel style={{ padding: '0 100px' }} />
          </Resizable.Root>
        </div>,
      );
      const handle = screen.getByTestId('handle');
      const start = handle.getBoundingClientRect().left;
      const pointer = { pointerId: 1, pointerType: 'mouse' };

      await fireEvent.pointerDown(handle, { ...pointer, clientX: start, buttons: 1 });
      await fireEvent.pointerMove(handle, { ...pointer, clientX: start + 50, buttons: 1 });
      await fireEvent.pointerUp(handle, { ...pointer, clientX: start + 50 });

      expect(handle.getBoundingClientRect().left - start).toBeCloseTo(50, 0);
    });
  });

  describe('state', () => {
    it('gives the orientation and the size to the render slot', async () => {
      await renderPanels({
        root: { orientation: 'vertical' },
        renderFirstPanel: ({ props, state }) => (
          <div {...props} class={`${state.orientation}-${state.size}`} />
        ),
        panels: [
          {
            defaultSize: 30,
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
        renderFirstPanel: ({ props, state }) => (
          <div {...props} class={`collapsed-${state.collapsed}`} />
        ),
        panels: [
          {
            ...collapsible,
            defaultSize: 40,
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

    it('warns once when a collapsible panel cannot collapse', async () => {
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

    it('restores the last requested size when three panel actions run before the DOM update', async () => {
      await renderPanels({ panels: [collapsible, withRef('b')] });

      instances.a.resize(35);
      instances.a.collapse();
      expect(instances.a.isCollapsed()).toBe(true);
      instances.a.expand();
      expect(instances.a.getSize().percent).toBe(35);

      await nextTick();
      expect([flexOf(0), flexOf(1)]).toEqual(['35', '65']);
    });

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
      { name: 'a drag in one move', drags: [[-400]], expected: ['40', '60'] },
      { name: 'a drag in two moves', drags: [[-250, -400]], expected: ['40', '60'] },
      { name: 'a drag from the least size', drags: [[-200], [-400]], expected: ['20', '80'] },
    ])(
      'gives back the size from the start of the drag that collapsed it with expand(), $name',
      async ({ drags, expected }) => {
        await renderPanels({ panels: [{ ...collapsible, defaultSize: 40 }, withRef('b')] });
        const handle = screen.getByTestId('handle-1');
        const pointer = { pointerId: 1, pointerType: 'mouse', buttons: 1 };

        for (const distances of drags) {
          await fireEvent.pointerDown(handle, { ...pointer, clientX: 0 });
          for (const distance of distances) {
            await fireEvent.pointerMove(handle, { ...pointer, clientX: distance });
          }
          await fireEvent.pointerUp(handle, { pointerId: 1, pointerType: 'mouse' });
        }
        expect([flexOf(0), flexOf(1)]).toEqual(['0', '100']);
        instances.a.expand();
        await nextTick();

        expect([flexOf(0), flexOf(1)]).toEqual(expected);
      },
    );

    it('gives back the size before a change of the layout of the app collapsed it with expand()', async () => {
      const layout = shallowRef<Record<string, number>>({ a: 40, b: 60 });
      await render(() => (
        <div style={{ width: '1000px' }}>
          <Resizable.Root
            layout={layout.value}
            {...{
              'onUpdate:layout': (next: Record<string, number>) => {
                layout.value = next;
              },
            }}
          >
            <Resizable.Panel {...collapsible} data-testid="panel-0" />
            <Resizable.Panel {...withRef('b')} data-testid="panel-1" />
          </Resizable.Root>
        </div>
      ));
      instances.a.collapse();
      await nextTick();
      instances.a.expand();
      await nextTick();
      expect([flexOf(0), flexOf(1)]).toEqual(['40', '60']);

      layout.value = { a: 30, b: 70 };
      await nextTick();
      layout.value = { a: 0, b: 100 };
      await nextTick();
      instances.a.expand();
      await nextTick();

      expect([flexOf(0), flexOf(1)]).toEqual(['30', '70']);
    });

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

    it('pushes the panels after the next panel with a root that does not push', async () => {
      await renderPanels({
        root: { pushPanels: false, defaultLayout: { a: 0, b: 20, c: 80 } },
        panels: [
          { ...withRef('a'), collapsible: true, minSize: 20 },
          { ...withRef('b'), minSize: 20 },
          withRef('c'),
        ],
      });

      instances.a.expand();
      await nextTick();

      expect([flexOf(0), flexOf(1), flexOf(2)]).toEqual(['20', '20', '60']);
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

    it('keeps the collapsed state of a panel while KeepAlive holds it', async () => {
      const Side = defineComponent({
        setup: () => () => <Resizable.Panel {...collapsible} defaultSize={0} />,
      });
      const show = shallowRef(true);
      await render(() => (
        <div style={{ width: '1000px' }}>
          <Resizable.Root>
            <KeepAlive>{show.value ? <Side /> : null}</KeepAlive>
            <Resizable.Handle />
            <Resizable.Panel id="b" />
          </Resizable.Root>
        </div>
      ));
      expect(instances.a.isCollapsed()).toBe(true);

      show.value = false;
      await nextTick();

      expect(instances.a.isCollapsed()).toBe(true);
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
        renderFirstPanel: ({ props, state }) => (
          <div {...props} class={`disabled-${state.disabled}`} />
        ),
        panels: [
          {
            id: 'a',
            disabled: true,
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

  describe('sizes with a unit', () => {
    // A length is a number of pixels of the panel space. The rows have the size and the pixels that
    // it gives in this page.
    const rem = () => Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const units = [
      { name: 'px', size: '200px', style: undefined, pixels: () => 200 },
      { name: 'em', size: '10em', style: { fontSize: '20px' }, pixels: () => 200 },
      { name: 'rem', size: '12rem', style: { fontSize: '24px' }, pixels: () => 12 * rem() },
      { name: 'vw', size: '20vw', style: undefined, pixels: () => window.innerWidth * 0.2 },
      { name: 'vh', size: '20vh', style: undefined, pixels: () => window.innerHeight * 0.2 },
    ] as const;

    it.each(units)('gives the size at the start in $name', async ({ size, style, pixels }) => {
      await renderPanels({ panels: [{ defaultSize: size, style }, {}] });

      expect(widthOf(0)).toBeCloseTo(pixels(), 0);
      expect(widthOf(1)).toBeCloseTo(1000 - pixels(), 0);
    });

    it.each(units)('has the least size in $name', async ({ size, style, pixels }) => {
      await renderPanels({ panels: [{ minSize: size, style }, {}] });

      await drag(screen.getByTestId('handle-1'), -900);

      expect(widthOf(0)).toBeCloseTo(pixels(), 0);
    });

    it.each(units)('has the greatest size in $name', async ({ size, style, pixels }) => {
      await renderPanels({ panels: [{ maxSize: size, style }, {}] });

      await drag(screen.getByTestId('handle-1'), 900);

      expect(widthOf(0)).toBeCloseTo(pixels(), 0);
    });

    it.each(units)('has the collapsed size in $name', async ({ size, style, pixels }) => {
      const { user } = await renderPanels({
        panels: [
          { collapsible: true, minSize: 50, defaultSize: 60, collapsedSize: size, style },
          {},
        ],
      });
      screen.getByTestId('handle-1').focus();

      await user.keyboard('{Enter}');

      expect(widthOf(0)).toBeCloseTo(pixels(), 0);
    });

    // The least size is 40%, which is 400 px, and the panel starts at its least size.
    it.each(units)(
      'collapses a drag that passes the collapse threshold in $name',
      async ({ size, style, pixels }) => {
        await renderPanels({
          panels: [
            { collapsible: true, minSize: 40, defaultSize: 40, collapseThreshold: size, style },
            {},
          ],
        });
        const handle = screen.getByTestId('handle-1');

        await drag(handle, -(pixels() - 2));
        expect(widthOf(0)).toBeCloseTo(400, 0);

        await drag(handle, -(pixels() + 2));
        expect(widthOf(0)).toBeCloseTo(0, 0);
      },
    );

    it('gives a panel in a vertical root a size in pixels of its height', async () => {
      await renderPanels({
        root: { orientation: 'vertical' },
        panels: [{ defaultSize: '100px', minSize: '80px' }, {}],
      });

      expect(screen.getByTestId('panel-0').getBoundingClientRect().height).toBeCloseTo(100, 0);
      expect(screen.getByTestId('panel-1').getBoundingClientRect().height).toBeCloseTo(300, 0);
    });

    it('gives the content of a panel the pixels, and not the panel with its padding', async () => {
      await renderPanels({
        panels: [
          { defaultSize: '200px', style: { padding: '0 30px', border: '5px solid' } },
          { style: { padding: '0 10px' } },
        ],
      });

      // The padding and the border of a panel are not in the panel space.
      expect(widthOf(0)).toBeCloseTo(200 + 70, 0);
    });

    it('keeps a least size in pixels when the root gets smaller, and gives the layout back', async () => {
      const width = shallowRef(1000);
      await renderPanels({ width, panels: [{ minSize: '200px', defaultSize: 25 }, {}] });
      expect(widthOf(0)).toBeCloseTo(250, 0);

      await changeWidth(width, 600);
      await waitFor(() => {
        expect(widthOf(0)).toBeCloseTo(200, 0);
      });
      expect(widthOf(1)).toBeCloseTo(400, 0);

      await changeWidth(width, 1000);
      await waitFor(() => {
        expect(widthOf(0)).toBeCloseTo(250, 0);
      });
    });

    it('follows the size of the window for a size in vw', async () => {
      const descriptor = Object.getOwnPropertyDescriptor(window, 'innerWidth');
      onTestFinished(() => {
        if (descriptor) {
          Object.defineProperty(window, 'innerWidth', descriptor);
        } else {
          Reflect.deleteProperty(window, 'innerWidth');
        }
      });
      await renderPanels({ panels: [{ minSize: '10vw', defaultSize: 5 }, {}] });
      expect(widthOf(0)).toBeCloseTo(Math.max(window.innerWidth * 0.1, 50), 0);
      // The observer of the root reads the page once after the mount. The size of the window
      // must change after that read, so that only the event of the window gives the new size.
      await waitSingleFrame();
      await waitSingleFrame();

      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 3000 });
      window.dispatchEvent(new Event('resize'));

      await waitFor(() => {
        expect(widthOf(0)).toBeCloseTo(300, 0);
      });
    });

    it('reads the font size of the panel again at the next drag', async () => {
      const fontSize = shallowRef('10px');
      await render(() => (
        <div style={{ width: '1000px' }}>
          <Resizable.Root>
            <Resizable.Panel
              data-testid="a"
              minSize="10em"
              defaultSize={20}
              style={{ fontSize: fontSize.value }}
            />
            <Resizable.Handle data-testid="handle" />
            <Resizable.Panel data-testid="b" />
          </Resizable.Root>
        </div>
      ));
      const panel = screen.getByTestId('a');
      expect(panel.getBoundingClientRect().width).toBeCloseTo(200, 0);

      // The least size was 100 px. It is 300 px with the new font size, and the panel has 200 px.
      fontSize.value = '30px';
      await nextTick();
      await drag(screen.getByTestId('handle'), -150);

      expect(panel.getBoundingClientRect().width).toBeCloseTo(300, 0);
    });

    it('keeps the percent that a default size in a length gave, when the root changes size', async () => {
      const width = shallowRef(1000);
      await renderPanels({ width, panels: [{ defaultSize: '200px' }, {}] });
      expect(widthOf(0)).toBeCloseTo(200, 0);

      await changeWidth(width, 1500);

      await waitFor(() => {
        expect(widthOf(0)).toBeCloseTo(300, 0);
      });
    });

    it('gives back the pixels of a default size in a length with reset() and a double click', async () => {
      const width = shallowRef(1000);
      const instance: { current?: InstanceType<typeof Resizable.Root> } = {};
      await renderPanels({
        width,
        root: {
          ref: (value: unknown) => {
            instance.current = value as InstanceType<typeof Resizable.Root>;
          },
        },
        panels: [{ defaultSize: '200px' }, {}],
      });
      await drag(screen.getByTestId('handle-1'), 100);
      expect(widthOf(0)).toBeCloseTo(300, 0);
      await changeWidth(width, 2000);
      await waitFor(() => {
        expect(widthOf(0)).toBeCloseTo(600, 0);
      });

      instance.current?.reset();
      await nextTick();
      expect(widthOf(0)).toBeCloseTo(200, 0);

      await drag(screen.getByTestId('handle-1'), 100);
      expect(widthOf(0)).toBeCloseTo(300, 0);
      await fireEvent.dblClick(screen.getByTestId('handle-1'));
      expect(widthOf(0)).toBeCloseTo(200, 0);
    });

    it('does not warn when the lengths of the panels cannot fit in a small root', async () => {
      // A window can be too small for a length, so this is not a mistake of the code.
      await renderPanels({ panels: [{ minSize: '700px' }, { minSize: '700px' }] });

      expect(takeReportedMessages()).toEqual([]);
    });

    it('does not warn for a collapsible panel whose least size is a length', async () => {
      await renderPanels({
        panels: [{ collapsible: true, minSize: '12rem', collapsedSize: '48px' }, {}],
      });

      expect(takeReportedMessages()).toEqual([]);
    });

    it('warns once when a collapsible panel cannot collapse with lengths', async () => {
      await renderPanels({
        panels: [{ collapsible: true, minSize: '40px', collapsedSize: '48px' }, {}],
      });

      expect(takeReportedMessages()).toEqual([
        expect.stringMatching(/^console\.warn: Vase UI: The panel ".*" is collapsible/),
      ]);
    });

    it('resizes with a length', async () => {
      const instance: { current?: InstanceType<typeof Resizable.Panel> } = {};
      await renderPanels({
        panels: [
          {
            minSize: '100px',
            ref: (value: unknown) => {
              instance.current = value as InstanceType<typeof Resizable.Panel>;
            },
          },
          {},
        ],
      });

      instance.current?.resize('250px');
      await nextTick();
      expect(widthOf(0)).toBeCloseTo(250, 0);

      instance.current?.resize('2rem');
      await nextTick();
      expect(widthOf(0)).toBeCloseTo(Math.max(2 * rem(), 100), 0);
    });
  });

  describe('prop: rootResizeBehavior', () => {
    // The layout is 20, 50 and 30 in a root of 1000 px. A handle has no size.
    const panels = [
      { id: 'nav', defaultSize: 20, rootResizeBehavior: 'fixed' },
      { id: 'editor', defaultSize: 50 },
      { id: 'preview' },
    ];

    it('keeps the pixels of a fixed panel when the root gets larger or smaller', async () => {
      const width = shallowRef(1000);
      await renderPanels({ width, panels });
      expect([widthOf(0), widthOf(1), widthOf(2)]).toEqual([
        expect.closeTo(200, 0),
        expect.closeTo(500, 0),
        expect.closeTo(300, 0),
      ]);

      // The other panels keep their ratio of 50 to 30 in the room that is left.
      await changeWidth(width, 1500);
      await waitFor(() => {
        expect(widthOf(1)).toBeCloseTo(812.5, 0);
      });
      expect(widthOf(0)).toBeCloseTo(200, 0);
      expect(widthOf(2)).toBeCloseTo(487.5, 0);

      await changeWidth(width, 500);
      await waitFor(() => {
        expect(widthOf(1)).toBeCloseTo(187.5, 0);
      });
      expect(widthOf(0)).toBeCloseTo(200, 0);
      expect(widthOf(2)).toBeCloseTo(112.5, 0);
    });

    it('scales a panel that is proportional with the root', async () => {
      const width = shallowRef(1000);
      await renderPanels({
        width,
        panels: [{ id: 'nav', defaultSize: 20, rootResizeBehavior: 'proportional' }, {}],
      });

      await changeWidth(width, 1500);

      await waitFor(() => {
        expect(widthOf(0)).toBeCloseTo(300, 0);
      });
    });

    it('emits no layout event for a size change of the root', async () => {
      const width = shallowRef(1000);
      const handlers = {
        onLayoutChange: vi.fn(),
        'onUpdate:layout': vi.fn(),
        onLayoutCommitted: vi.fn(),
      };
      await renderPanels({ width, root: handlers, panels });

      await changeWidth(width, 1500);
      await waitFor(() => {
        expect(widthOf(1)).toBeCloseTo(812.5, 0);
      });

      for (const handler of Object.values(handlers)) {
        expect(handler).not.toHaveBeenCalled();
      }
    });

    it('gives the panel new pixels with a drag', async () => {
      const width = shallowRef(1000);
      await renderPanels({ width, panels });

      await drag(screen.getByTestId('handle-1'), 100);
      expect(widthOf(0)).toBeCloseTo(300, 0);
      await changeWidth(width, 1500);

      await waitFor(() => {
        expect(widthOf(1)).toBeCloseTo(685.7, 0);
      });
      expect(widthOf(0)).toBeCloseTo(300, 0);
    });

    it('gives the panel new pixels with a key', async () => {
      const width = shallowRef(1000);
      const { user } = await renderPanels({ width, panels });
      screen.getByTestId('handle-1').focus();

      await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
      expect(widthOf(0)).toBeCloseTo(300, 0);
      await changeWidth(width, 1500);

      await waitFor(() => {
        expect(widthOf(1)).toBeCloseTo(685.7, 0);
      });
      expect(widthOf(0)).toBeCloseTo(300, 0);
    });

    it('gives the panel new pixels with a percent in the layout of the app', async () => {
      const width = shallowRef(1000);
      const layout = shallowRef<Record<string, number>>({ nav: 20, editor: 50, preview: 30 });
      await render(() => (
        <div style={{ width: `${width.value}px` }}>
          <Resizable.Root layout={layout.value}>
            <Resizable.Panel id="nav" data-testid="panel-0" rootResizeBehavior="fixed" />
            <Resizable.Panel id="editor" data-testid="panel-1" />
            <Resizable.Panel id="preview" data-testid="panel-2" />
          </Resizable.Root>
        </div>
      ));
      expect(widthOf(0)).toBeCloseTo(200, 0);

      layout.value = { nav: 30, editor: 40, preview: 30 };
      await nextTick();
      expect(widthOf(0)).toBeCloseTo(300, 0);
      await changeWidth(width, 1500);

      await waitFor(() => {
        expect(widthOf(1)).toBeCloseTo(685.7, 0);
      });
      expect(widthOf(0)).toBeCloseTo(300, 0);
    });

    it('gives the panel the pixels of a size in the layout of the app', async () => {
      const width = shallowRef(1000);
      const layout = shallowRef<Record<string, number | string>>({
        nav: 20,
        editor: 50,
        preview: 30,
      });
      await render(() => (
        <div style={{ width: `${width.value}px` }}>
          <Resizable.Root layout={layout.value}>
            <Resizable.Panel id="nav" data-testid="panel-0" rootResizeBehavior="fixed" />
            <Resizable.Panel id="editor" data-testid="panel-1" />
            <Resizable.Panel id="preview" data-testid="panel-2" />
          </Resizable.Root>
        </div>
      ));

      layout.value = { nav: '300px', editor: 40, preview: 30 };
      await nextTick();
      expect(widthOf(0)).toBeCloseTo(300, 0);
      await changeWidth(width, 1500);

      await waitFor(() => {
        expect(widthOf(1)).toBeCloseTo(685.7, 0);
      });
      expect(widthOf(0)).toBeCloseTo(300, 0);
    });

    it('does not take new pixels when the app gives the layout that it has', async () => {
      const width = shallowRef(1000);
      const renders = shallowRef(0);
      await render(() => (
        <div style={{ width: `${width.value}px` }} data-renders={renders.value}>
          {/* A new object with the same sizes at each render, as a template literal gives. */}
          <Resizable.Root layout={{ nav: 20, editor: 50, preview: 30 }}>
            <Resizable.Panel id="nav" data-testid="panel-0" rootResizeBehavior="fixed" />
            <Resizable.Panel id="editor" data-testid="panel-1" />
            <Resizable.Panel id="preview" data-testid="panel-2" />
          </Resizable.Root>
        </div>
      ));
      await changeWidth(width, 1500);
      await waitFor(() => {
        expect(widthOf(1)).toBeCloseTo(812.5, 0);
      });

      // The parent renders again with the same layout, and the root has read the new width.
      renders.value += 1;
      await nextTick();

      expect(widthOf(0)).toBeCloseTo(200, 0);
      expect(widthOf(1)).toBeCloseTo(812.5, 0);
    });

    it('gives a fixed panel that mounts later its pixels', async () => {
      const width = shallowRef(1000);
      const show = shallowRef(false);
      await render(() => (
        <div style={{ width: `${width.value}px` }}>
          <Resizable.Root>
            <Resizable.Panel id="a" data-testid="panel-0" />
            <Resizable.Handle />
            <Resizable.Panel id="b" data-testid="panel-1" />
            {show.value ? (
              <>
                <Resizable.Handle />
                <Resizable.Panel
                  id="late"
                  data-testid="panel-2"
                  defaultSize={20}
                  rootResizeBehavior="fixed"
                />
              </>
            ) : null}
          </Resizable.Root>
        </div>
      ));

      show.value = true;
      await nextTick();
      await waitFor(() => {
        expect(widthOf(2)).toBeCloseTo(200, 0);
      });
      await changeWidth(width, 1500);

      await waitFor(() => {
        expect(widthOf(0)).toBeCloseTo(650, 0);
      });
      expect(widthOf(2)).toBeCloseTo(200, 0);
    });

    it('gives a panel that becomes fixed its pixels', async () => {
      const width = shallowRef(1000);
      const behavior = shallowRef<'fixed' | 'proportional'>('proportional');
      await render(() => (
        <div style={{ width: `${width.value}px` }}>
          <Resizable.Root>
            <Resizable.Panel
              id="a"
              data-testid="panel-0"
              defaultSize={20}
              rootResizeBehavior={behavior.value}
            />
            <Resizable.Panel id="b" data-testid="panel-1" />
          </Resizable.Root>
        </div>
      ));

      behavior.value = 'fixed';
      await nextTick();
      await changeWidth(width, 1500);

      await waitFor(() => {
        expect(widthOf(1)).toBeCloseTo(1300, 0);
      });
      expect(widthOf(0)).toBeCloseTo(200, 0);
    });

    it('takes the room of a size change from the panel with the greater priority first', async () => {
      const width = shallowRef(1000);
      await renderPanels({
        width,
        panels: [
          { id: 'nav', defaultSize: 30, minSize: 10, rootResizeBehavior: 'fixed' },
          { id: 'editor', defaultSize: 40, minSize: 40 },
          {
            id: 'aside',
            defaultSize: 30,
            minSize: 10,
            rootResizeBehavior: 'fixed',
            rootResizePriority: 1,
          },
        ],
      });

      // The two pins of 300 px are 37.5% each at 800 px, and the editor has 40% at the least.
      await changeWidth(width, 800);

      await waitFor(() => {
        expect(widthOf(2)).toBeCloseTo(180, 0);
      });
      expect(widthOf(0)).toBeCloseTo(300, 0);
      expect(widthOf(1)).toBeCloseTo(320, 0);
    });

    it('takes the room of a size change from the first fixed panel with no priority', async () => {
      const width = shallowRef(1000);
      await renderPanels({
        width,
        panels: [
          { id: 'nav', defaultSize: 30, minSize: 10, rootResizeBehavior: 'fixed' },
          { id: 'editor', defaultSize: 40, minSize: 40 },
          { id: 'aside', defaultSize: 30, minSize: 10, rootResizeBehavior: 'fixed' },
        ],
      });

      await changeWidth(width, 800);

      await waitFor(() => {
        expect(widthOf(0)).toBeCloseTo(180, 0);
      });
      expect(widthOf(2)).toBeCloseTo(300, 0);
      expect(widthOf(1)).toBeCloseTo(320, 0);
    });

    it('warns once when each panel is fixed', async () => {
      await renderPanels({
        panels: [
          { id: 'a', rootResizeBehavior: 'fixed' },
          { id: 'b', rootResizeBehavior: 'fixed' },
        ],
      });

      expect(takeReportedMessages()).toEqual([
        expect.stringMatching(/^console\.warn: Vase UI: Each panel of the root is fixed\./),
      ]);
    });
  });

  describe('prop: snapPoints', () => {
    // A handle has no size, so 1% is 10 px. The panel `a` starts at 50%.
    const snapping = { id: 'a', defaultSize: 50 };

    it.each([
      { name: 'in percent, from above', snapPoints: [40], distance: -80, expected: '40' },
      { name: 'in percent, from below', snapPoints: [40], distance: -120, expected: '40' },
      {
        name: 'in percent, at the edge of the tolerance',
        snapPoints: [40],
        distance: -110,
        expected: '40',
      },
      {
        name: 'in percent, outside the tolerance',
        snapPoints: [40],
        distance: -130,
        expected: '37',
      },
      { name: 'in pixels', snapPoints: ['400px'], distance: -96, expected: '40' },
      { name: 'in rem', snapPoints: ['25rem'], distance: -96, expected: '40' },
      { name: 'one of two', snapPoints: [20, 40], distance: -96, expected: '40' },
    ])('snaps a drag to a snap point $name', async ({ snapPoints, distance, expected }) => {
      await renderPanels({
        panels: [{ ...snapping, snapPoints, snapTolerance: '2%' }, {}],
      });

      await drag(screen.getByTestId('handle-1'), distance);

      expect(flexOf(0)).toBe(expected);
    });

    it('has a tolerance of 10 px by default', async () => {
      await renderPanels({ panels: [{ ...snapping, snapPoints: [40] }, {}] });
      const handle = screen.getByTestId('handle-1');

      await drag(handle, -109);
      expect(flexOf(0)).toBe('40');

      await drag(handle, 111);
      expect(flexOf(0)).toBe('51.1');
    });

    it('has the tolerance that snapTolerance gives', async () => {
      await renderPanels({
        panels: [{ ...snapping, snapPoints: [40], snapTolerance: '30px' }, {}],
      });
      const handle = screen.getByTestId('handle-1');

      await drag(handle, -125);
      expect(flexOf(0)).toBe('40');

      await drag(handle, 140);
      expect(flexOf(0)).toBe('54');
    });

    it('snaps the panel after the handle too', async () => {
      await renderPanels({
        panels: [{ id: 'a' }, { id: 'b', defaultSize: 50, snapPoints: [40], snapTolerance: 2 }],
      });

      await drag(screen.getByTestId('handle-1'), 96);

      expect(flexOf(1)).toBe('40');
    });

    it('does not snap a key', async () => {
      const { user } = await renderPanels({
        panels: [{ ...snapping, defaultSize: 45, snapPoints: [40], snapTolerance: 10 }, {}],
      });
      screen.getByTestId('handle-1').focus();

      await user.keyboard('{ArrowLeft}');

      expect(flexOf(0)).toBe('44');
    });

    it('does not snap a method', async () => {
      const instance: { current?: InstanceType<typeof Resizable.Panel> } = {};
      await renderPanels({
        panels: [
          {
            ...snapping,
            snapPoints: [40],
            snapTolerance: 10,
            ref: (value: unknown) => {
              instance.current = value as InstanceType<typeof Resizable.Panel>;
            },
          },
          {},
        ],
      });

      instance.current?.resize(43);
      await nextTick();

      expect(flexOf(0)).toBe('43');
    });
  });

  describe('event: resize', () => {
    const sizes = (handler: ReturnType<typeof vi.fn>) =>
      handler.mock.calls.map(([size, previous]) => [size, previous]);

    it('is emitted one time after the mount, with the pixels of the panel', async () => {
      const onResize = vi.fn();
      await renderPanels({ panels: [{ defaultSize: 30, onResize }, {}] });

      await waitFor(() => {
        expect(onResize).toHaveBeenCalledTimes(1);
      });
      expect(sizes(onResize)).toEqual([[{ percent: 30, pixels: 300 }, undefined]]);
      expect(widthOf(0)).toBeCloseTo(300, 0);
    });

    it('is emitted for a drag with the size before it', async () => {
      const onResize = vi.fn();
      await renderPanels({ panels: [{ defaultSize: 30, onResize }, {}] });
      await waitFor(() => {
        expect(onResize).toHaveBeenCalledTimes(1);
      });

      await drag(screen.getByTestId('handle-1'), 100);

      await waitFor(() => {
        expect(onResize).toHaveBeenCalledTimes(2);
      });
      expect(sizes(onResize)[1]).toEqual([
        { percent: 40, pixels: 400 },
        { percent: 30, pixels: 300 },
      ]);
    });

    it('is emitted for a size change of the root: the percent stays and the pixels change', async () => {
      const width = shallowRef(1000);
      const onResize = vi.fn();
      await renderPanels({ width, panels: [{ defaultSize: 30, onResize }, {}] });
      await waitFor(() => {
        expect(onResize).toHaveBeenCalledTimes(1);
      });

      await changeWidth(width, 2000);

      await waitFor(() => {
        expect(onResize).toHaveBeenCalledTimes(2);
      });
      expect(sizes(onResize)[1]).toEqual([
        { percent: 30, pixels: 600 },
        { percent: 30, pixels: 300 },
      ]);
    });

    it('is emitted for a fixed panel when the root changes size, with the same pixels', async () => {
      const width = shallowRef(1000);
      const onResize = vi.fn();
      await renderPanels({
        width,
        panels: [{ defaultSize: 20, rootResizeBehavior: 'fixed', onResize }, {}],
      });
      await waitFor(() => {
        expect(onResize).toHaveBeenCalledTimes(1);
      });

      await changeWidth(width, 2000);

      await waitFor(() => {
        expect(onResize).toHaveBeenCalledTimes(2);
      });
      expect(sizes(onResize)[1]).toEqual([
        { percent: 10, pixels: 200 },
        { percent: 20, pixels: 200 },
      ]);
    });

    it('is not emitted for a change of another panel that leaves the panel as it is', async () => {
      const onResize = vi.fn();
      await renderPanels({ panels: [{ id: 'a', defaultSize: 30, onResize }, {}, {}] });
      await waitFor(() => {
        expect(onResize).toHaveBeenCalledTimes(1);
      });

      await drag(screen.getByTestId('handle-2'), 50);

      expect(flexOf(1)).toBe('40');
      expect(onResize).toHaveBeenCalledTimes(1);
    });

    it('is emitted with a length that gives the first size, once', async () => {
      const onResize = vi.fn();
      await renderPanels({ panels: [{ defaultSize: '240px', onResize }, {}] });

      await waitFor(() => {
        expect(onResize).toHaveBeenCalledTimes(1);
      });
      expect(sizes(onResize)).toEqual([[{ percent: 24, pixels: 240 }, undefined]]);
    });

    it('is emitted after the panel shows again when a size changed under KeepAlive', async () => {
      const width = shallowRef(1000);
      const visible = shallowRef(true);
      const onResize = vi.fn();
      const Side = defineComponent({
        setup: () => () => <Resizable.Panel id="a" defaultSize={30} onResize={onResize} />,
      });
      await render(() => (
        <div style={{ width: `${width.value}px` }}>
          <Resizable.Root>
            <KeepAlive>{visible.value ? <Side /> : null}</KeepAlive>
            <Resizable.Panel id="b" data-testid="b" />
          </Resizable.Root>
        </div>
      ));
      await waitFor(() => {
        expect(onResize).toHaveBeenCalledTimes(1);
      });

      visible.value = false;
      await nextTick();
      await changeWidth(width, 2000);
      await waitFor(() => {
        expect(screen.getByTestId('b').getBoundingClientRect().width).toBeCloseTo(2000, 0);
      });
      expect(onResize).toHaveBeenCalledTimes(1);

      visible.value = true;
      await nextTick();

      await waitFor(() => {
        expect(onResize).toHaveBeenCalledTimes(2);
      });
      expect(sizes(onResize)[1]?.[0]).toEqual({ percent: 30, pixels: 600 });
    });
  });

  describe('hydration', () => {
    removedPartHydrationTests({
      file: 'src/resizable/root/ResizableRootHydration.test.vue',
      component: ResizableRootHydration,
      cases: [
        {
          name: 'a removed panel, data-collapsed',
          props: { composition: 'collapsed', laterRemovedAtMount: true },
          selector: '[data-testid="a"]',
          attribute: 'data-collapsed',
          serverValue: '',
          clientValue: null,
        },
        {
          name: 'a stored layout, data-collapsed',
          props: { composition: 'stored' },
          selector: '[data-testid="a"]',
          attribute: 'data-collapsed',
          serverValue: '',
          clientValue: null,
        },
      ],
    });

    it('gives the collapsed state of the server HTML to both panel slots while it hydrates', async () => {
      const props = { composition: 'slotStyles' };
      const serverHtml = await renderOnServer(
        'src/resizable/root/ResizableRootHydration.test.vue',
        props,
      );

      const { container } = await hydrate(ResizableRootHydration, { serverHtml, props });

      const panel = container.querySelector('[data-testid="a"]');
      expect(panel).toHaveClass('collapsed');
      expect(panel?.textContent).toBe('Closed');
      expect(container.querySelector('[data-testid="c"]')).toHaveTextContent('Closed');
    });
  });

  describe('method: getSize()', () => {
    it('gives the size in percent and in pixels', async () => {
      const instances: Record<string, InstanceType<typeof Resizable.Panel>> = {};
      const withRef = (id: string) => ({
        id,
        ref: (value: unknown) => {
          instances[id] = value as InstanceType<typeof Resizable.Panel>;
        },
      });
      const width = shallowRef(1000);
      await renderPanels({ width, panels: [{ ...withRef('a'), defaultSize: 30 }, withRef('b')] });
      expect(instances.a?.getSize()).toEqual({ percent: 30, pixels: 300 });
      expect(instances.b?.getSize()).toEqual({ percent: 70, pixels: 700 });

      // The method reads the page, so it has the pixels before the observer of the root does. The
      // observer reads the page in the next frame, and the case does not wait for it.
      await flushMicrotasks();
      width.value = 2000;
      await nextTick();
      expect(instances.a?.getSize()).toEqual({ percent: 30, pixels: 600 });
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

    // On Vue 3.6.0-rc.15, a Vapor parent reports the child's render error a second time.
    expect(takeReportedMessages()).toEqual(
      Array.from({ length: isVaporParts && !isVueMinor ? 2 : 1 }, () =>
        expect.stringContaining('Unhandled error during execution of render function'),
      ),
    );
  });
});
