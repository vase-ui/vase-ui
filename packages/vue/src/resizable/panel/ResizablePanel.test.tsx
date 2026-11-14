import { describe, expect, it, vi } from 'vitest';
import { nextTick, shallowRef } from 'vue';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  screen,
  takeReportedMessages,
} from '#test-utils';
import * as Resizable from '../index.parts';

describe('<Resizable.Panel />', () => {
  const { render } = createRenderer();

  // The container is 1000 px wide and 400 px high, and a handle has no size.
  function renderPanels(options: {
    root?: Record<string, unknown>;
    panels: Record<string, unknown>[];
  }) {
    return render(
      <div style={{ width: '1000px', height: '400px' }}>
        <Resizable.Root style={{ height: '100%' }} {...options.root}>
          {options.panels.flatMap((panel, index) => [
            index > 0 ? (
              <Resizable.Handle key={`handle-${index}`} data-testid={`handle-${index}`} />
            ) : null,
            <Resizable.Panel key={`panel-${index}`} data-testid={`panel-${index}`} {...panel} />,
          ])}
        </Resizable.Root>
      </div>,
    );
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
