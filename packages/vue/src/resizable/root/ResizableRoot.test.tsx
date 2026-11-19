import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
  KeepAlive,
  Teleport,
  createSSRApp,
  defineComponent,
  h,
  nextTick,
  onDeactivated,
  onMounted,
  shallowRef,
} from 'vue';
import type { ShallowRef } from 'vue';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import { Toolbar } from '@vase-ui/vue/toolbar';
import {
  createHeldBranch,
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  heldMountListTests,
  hydrate,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
  waitSingleFrame,
  within,
} from '#test-utils';
import { REASONS } from '../../internals/reasons';
import { Resizable } from '@vase-ui/vue/resizable';
import { createSlotHost } from '../../../test/fixtures/slotHost';
import ResizableRootHydration from './ResizableRootHydration.test.vue';
import ResizableRootLatePanel from './ResizableRootLatePanel.test.vue';

describe('<Resizable.Root />', () => {
  const { render } = createRenderer();

  heldMountListTests({
    render,
    renderList: (withLastItem) => (
      <div style={{ width: '1000px', height: '400px' }}>
        <Resizable.Root style={{ height: '100%' }} defaultLayout={{ a: 40, b: 60 }}>
          <Resizable.Panel id="a" />
          {withLastItem
            ? [
                <Resizable.Handle key="handle" data-testid="handle" />,
                <Resizable.Panel key="b" id="b" />,
              ]
            : null}
        </Resizable.Root>
      </div>
    ),
    check() {
      const handle = screen.getByTestId('handle');
      expect(handle).toHaveAttribute('aria-controls', 'a');
      expect(handle).toHaveAttribute('aria-valuenow', '40');
    },
  });

  const pointer = { pointerId: 1, pointerType: 'mouse' };

  // The container is 1000 px wide, and a handle has no size, so 1% of the panel space is 10 px.
  function Three(props: { root?: Record<string, unknown> }) {
    return (
      <div style={{ width: '1000px' }}>
        <Resizable.Root data-testid="root" {...props.root}>
          <Resizable.Panel id="a" data-testid="a" />
          <Resizable.Handle data-testid="handle-a" />
          <Resizable.Panel id="b" data-testid="b" />
          <Resizable.Handle data-testid="handle-b" />
          <Resizable.Panel id="c" data-testid="c" />
        </Resizable.Root>
      </div>
    );
  }

  async function drag(testId: string, distance: number) {
    const handle = screen.getByTestId(testId);
    await fireEvent.pointerDown(handle, { ...pointer, clientX: 0, buttons: 1 });
    await fireEvent.pointerMove(handle, { ...pointer, clientX: distance, buttons: 1 });
    await fireEvent.pointerUp(handle, { ...pointer, clientX: distance });
  }

  const grows = (...ids: string[]) => ids.map((id) => screen.getByTestId(id).style.flexGrow);

  describeConformance(<Resizable.Root />, () => ({
    render: (node) => render(node),
    refInstanceof: window.HTMLDivElement,
  }));

  describe('style and attributes', () => {
    it.each([
      { name: 'horizontal', orientation: 'horizontal', direction: 'row' },
      { name: 'vertical', orientation: 'vertical', direction: 'column' },
    ] as const)('is a flex container for a $name root', async ({ orientation, direction }) => {
      await render(<Resizable.Root data-testid="root" orientation={orientation} />);
      const root = screen.getByTestId('root');

      expect(root.style.display).toBe('flex');
      expect(root.style.flexDirection).toBe(direction);
      expect(root).toHaveAttribute('data-orientation', orientation);
    });

    it('keeps the style of a consumer, which wins over the style of the root', async () => {
      await render(<Resizable.Root data-testid="root" style={{ display: 'grid', color: 'red' }} />);
      const root = screen.getByTestId('root');

      expect(root.style.display).toBe('grid');
      expect(root.style.flexDirection).toBe('row');
      expect(root.style.color).toBe('red');
    });

    it('has data-disabled with the disabled prop only', async () => {
      const { setProps } = await render(<Resizable.Root data-testid="root" />);
      expect(screen.getByTestId('root')).not.toHaveAttribute('data-disabled');

      await setProps({ disabled: true });

      expect(screen.getByTestId('root')).toHaveAttribute('data-disabled');
    });

    it('has data-dragging from the press to the release of a handle', async () => {
      await render(<Three />);
      const root = screen.getByTestId('root');
      expect(root).not.toHaveAttribute('data-dragging');

      await fireEvent.pointerDown(screen.getByTestId('handle-a'), {
        ...pointer,
        clientX: 0,
        buttons: 1,
      });
      expect(root).toHaveAttribute('data-dragging');
      await fireEvent.pointerUp(screen.getByTestId('handle-a'), pointer);

      expect(root).not.toHaveAttribute('data-dragging');
    });

    it('gives the orientation, disabled state and drag state to the default slot', async () => {
      await render(
        <Resizable.Root data-testid="root" orientation="vertical">
          {{
            default: ({ state }: { state: Resizable.Root.State }) => (
              <span class={`${state.orientation}-${state.disabled}`}>
                dragging {String(state.dragging)}
              </span>
            ),
          }}
        </Resizable.Root>,
      );

      expect(screen.getByTestId('root').firstElementChild).toHaveClass('vertical-false');
      expect(screen.getByTestId('root')).toHaveTextContent('dragging false');
    });
  });

  describe('prop: defaultLayout', () => {
    it('gives each panel its size', async () => {
      await render(<Three root={{ defaultLayout: { a: 20, b: 30, c: 50 } }} />);

      expect(grows('a', 'b', 'c')).toEqual(['20', '30', '50']);
    });

    it('gives a panel that it lacks the size that is left', async () => {
      await render(<Three root={{ defaultLayout: { a: 50 } }} />);

      expect(grows('a', 'b', 'c')).toEqual(['50', '25', '25']);
    });

    it('gives the panels their ratio when an entry names a panel that is not mounted', async () => {
      await render(<Three root={{ defaultLayout: { a: 30, b: 30, c: 30, gone: 10 } }} />);

      expect(grows('a', 'b', 'c')).toEqual(['33.334', '33.333', '33.333']);
    });

    it('gives a panel whose entry is not a size the size that is left, and warns', async () => {
      await render(<Three root={{ defaultLayout: { a: '1fr', b: 30 } }} />);

      expect(grows('a', 'b', 'c')).toEqual(['35', '30', '35']);
      expect(takeReportedMessages()).toEqual([
        'console.warn: Vase UI: The layout gives the panel "a" the size "1fr", which is not valid. The root ignores this size, so the panel takes its `defaultSize`, or an equal share of the space that is left. Use a number of 0 or more, or a string of such a number with an optional unit: "%", "px", "em", "rem", "vh" or "vw".',
      ]);
    });
  });

  describe('prop: layout', () => {
    it('shows the layout, and shows a move only after the parent writes it', async () => {
      const layout = shallowRef<Record<string, number>>({ a: 30, b: 30, c: 40 });
      const onLayoutChange = vi.fn();
      await render(() => <Three root={{ layout: layout.value, onLayoutChange }} />);
      expect(grows('a', 'b', 'c')).toEqual(['30', '30', '40']);

      await drag('handle-a', 100);
      expect(onLayoutChange).toHaveBeenCalledWith({ a: 40, b: 20, c: 40 }, expect.anything());
      expect(grows('a', 'b', 'c')).toEqual(['30', '30', '40']);

      layout.value = { a: 40, b: 20, c: 40 };
      await nextTick();

      expect(grows('a', 'b', 'c')).toEqual(['40', '20', '40']);
    });

    it('follows a v-model: the parent writes each change', async () => {
      const layout = shallowRef<Record<string, number>>({});
      await render(() => (
        <Three
          root={{
            layout: layout.value,
            'onUpdate:layout': (next: Record<string, number>) => {
              layout.value = next;
            },
          }}
        />
      ));

      await drag('handle-a', 100);
      expect(layout.value).toEqual({ a: 43.334, b: 23.333, c: 33.333 });
      expect(grows('a', 'b', 'c')).toEqual(['43.334', '23.333', '33.333']);

      layout.value = {};
      await nextTick();

      expect(grows('a', 'b', 'c')).toEqual(['33.334', '33.333', '33.333']);
    });

    it('reads a null layout as a layout with no entries, and stays controlled', async () => {
      const onLayoutChange = vi.fn();
      await render(<Three root={{ layout: null, onLayoutChange }} />);
      expect(grows('a', 'b', 'c')).toEqual(['33.334', '33.333', '33.333']);

      await drag('handle-a', 100);

      expect(onLayoutChange).toHaveBeenCalledWith(
        { a: 43.334, b: 23.333, c: 33.333 },
        expect.anything(),
      );
      expect(grows('a', 'b', 'c')).toEqual(['33.334', '33.333', '33.333']);
    });

    it('reads a layout that changes to null as a layout with no entries, not as the default layout', async () => {
      const layout = shallowRef<Record<string, number> | null>({ a: 20, b: 30, c: 50 });
      const defaultLayout = { a: 50, b: 25, c: 25 };
      await render(() => <Three root={{ layout: layout.value, defaultLayout }} />);
      expect(grows('a', 'b', 'c')).toEqual(['20', '30', '50']);

      layout.value = null;
      await nextTick();

      expect(grows('a', 'b', 'c')).toEqual(['33.334', '33.333', '33.333']);
    });

    it('resizes from the last layout when the parent releases it', async () => {
      const layout = shallowRef<Record<string, number> | undefined>({ a: 20, b: 30, c: 50 });
      await render(() => <Three root={{ layout: layout.value }} />);

      layout.value = undefined;
      await nextTick();
      expect(grows('a', 'b', 'c')).toEqual(['20', '30', '50']);
      await drag('handle-a', 100);
      expect(grows('a', 'b', 'c')).toEqual(['30', '20', '50']);
    });
  });

  describe('change events', () => {
    it('emits layoutChange and then update:layout, with the same layout', async () => {
      const calls: [string, Record<string, number>][] = [];
      await render(
        <Three
          root={{
            onLayoutChange: (layout: Record<string, number>) =>
              calls.push(['layoutChange', layout]),
            'onUpdate:layout': (layout: Record<string, number>) =>
              calls.push(['update:layout', layout]),
          }}
        />,
      );

      await drag('handle-a', 100);

      expect(calls.map(([name]) => name)).toEqual(['layoutChange', 'update:layout']);
      expect(calls[0]?.[1]).toBe(calls[1]?.[1]);
      expect(calls[0]?.[1]).toEqual({ a: 43.334, b: 23.333, c: 33.333 });
    });

    it.each([
      { name: 'a drag', act: () => drag('handle-a', 100) },
      {
        name: 'a key',
        act: () => fireEvent.keyDown(screen.getByTestId('handle-a'), { key: 'ArrowRight' }),
      },
    ])(
      'keeps the layout, and emits no update:layout and no layoutCommitted, when a listener cancels the change of $name',
      async ({ act }) => {
        const onUpdate = vi.fn();
        const onCommitted = vi.fn();
        await render(
          <Three
            root={{
              onLayoutChange: (_layout: unknown, details: { cancel: () => void }) => {
                details.cancel();
              },
              'onUpdate:layout': onUpdate,
              onLayoutCommitted: onCommitted,
            }}
          />,
        );

        await act();

        expect(onUpdate).not.toHaveBeenCalled();
        expect(onCommitted).not.toHaveBeenCalled();
        expect(grows('a', 'b', 'c')).toEqual(['33.334', '33.333', '33.333']);
      },
    );

    it('emits nothing at the mount', async () => {
      const handlers = {
        onLayoutChange: vi.fn(),
        'onUpdate:layout': vi.fn(),
        onLayoutCommitted: vi.fn(),
        onDraggingChange: vi.fn(),
      };
      await render(<Three root={handlers} />);

      for (const handler of Object.values(handlers)) {
        expect(handler).not.toHaveBeenCalled();
      }
    });

    it('gives the reason drag with the event of the pointer', async () => {
      const onLayoutChange = vi.fn();
      await render(<Three root={{ onLayoutChange }} />);

      await drag('handle-a', 100);

      const details = onLayoutChange.mock.calls[0]?.[1];
      expect(details.reason).toBe(REASONS.drag);
      expect(details.event.type).toBe('pointermove');
    });

    it('gives the reason keyboard with the event of the key', async () => {
      const onLayoutChange = vi.fn();
      const onLayoutCommitted = vi.fn();
      await render(<Three root={{ onLayoutChange, onLayoutCommitted }} />);

      await fireEvent.keyDown(screen.getByTestId('handle-a'), { key: 'ArrowRight' });

      expect(onLayoutChange).toHaveBeenCalledTimes(1);
      expect(onLayoutChange.mock.calls[0]?.[1].reason).toBe(REASONS.keyboard);
      expect(onLayoutChange.mock.calls[0]?.[1].event.type).toBe('keydown');
      expect(onLayoutCommitted).toHaveBeenCalledTimes(1);
      expect(onLayoutCommitted.mock.calls[0]?.[1].reason).toBe(REASONS.keyboard);
      expect(onLayoutCommitted.mock.calls[0]?.[0]).toEqual(onLayoutChange.mock.calls[0]?.[0]);
    });

    it('emits layoutChange for each move, and layoutCommitted one time at the release', async () => {
      const onLayoutChange = vi.fn();
      const onLayoutCommitted = vi.fn();
      await render(<Three root={{ onLayoutChange, onLayoutCommitted }} />);
      const handle = screen.getByTestId('handle-a');

      await fireEvent.pointerDown(handle, { ...pointer, clientX: 0, buttons: 1 });
      await fireEvent.pointerMove(handle, { ...pointer, clientX: 50, buttons: 1 });
      await fireEvent.pointerMove(handle, { ...pointer, clientX: 100, buttons: 1 });
      expect(onLayoutChange).toHaveBeenCalledTimes(2);
      expect(onLayoutCommitted).not.toHaveBeenCalled();

      await fireEvent.pointerUp(handle, { ...pointer, clientX: 100 });

      expect(onLayoutChange).toHaveBeenCalledTimes(2);
      expect(onLayoutCommitted).toHaveBeenCalledTimes(1);
      expect(onLayoutCommitted).toHaveBeenCalledWith(
        { a: 43.334, b: 23.333, c: 33.333 },
        expect.objectContaining({ reason: REASONS.drag }),
      );
      expect(onLayoutCommitted.mock.calls[0]?.[1].event.type).toBe('pointerup');
    });

    it.each([
      { name: 'a move of 0 px', distance: 0 },
      { name: 'a move that the rounding takes away', distance: 0.0001 },
    ])(
      'emits no change and no layoutCommitted for $name, and still reports the drag',
      async ({ distance }) => {
        const onLayoutChange = vi.fn();
        const onLayoutCommitted = vi.fn();
        const onDraggingChange = vi.fn();
        await render(<Three root={{ onLayoutChange, onLayoutCommitted, onDraggingChange }} />);

        await drag('handle-a', distance);

        expect(onLayoutChange).not.toHaveBeenCalled();
        expect(onLayoutCommitted).not.toHaveBeenCalled();
        expect(onDraggingChange).toHaveBeenCalledTimes(2);
      },
    );

    it('emits draggingChange with true at the press and with false at the end', async () => {
      const onDraggingChange = vi.fn();
      await render(<Three root={{ onDraggingChange }} />);
      const handle = screen.getByTestId('handle-a');

      await fireEvent.pointerDown(handle, { ...pointer, clientX: 0, buttons: 1 });
      expect(onDraggingChange.mock.calls).toEqual([[true]]);
      await fireEvent.pointerMove(handle, { ...pointer, clientX: 100, buttons: 1 });
      expect(onDraggingChange).toHaveBeenCalledTimes(1);
      await fireEvent.pointerUp(handle, { ...pointer, clientX: 100 });

      expect(onDraggingChange.mock.calls).toEqual([[true], [false]]);
    });
  });

  describe('one drag in a root', () => {
    it('starts no drag with a press on another handle while a drag runs', async () => {
      const onDraggingChange = vi.fn();
      await render(<Three root={{ onDraggingChange }} />);
      const first = screen.getByTestId('handle-a');
      const second = screen.getByTestId('handle-b');

      await fireEvent.pointerDown(first, {
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 0,
        buttons: 1,
      });
      await fireEvent.pointerDown(second, {
        pointerId: 2,
        pointerType: 'touch',
        clientX: 0,
        buttons: 1,
      });
      await fireEvent.pointerMove(second, {
        pointerId: 2,
        pointerType: 'touch',
        clientX: 100,
        buttons: 1,
      });

      expect(first).toHaveAttribute('data-dragging');
      expect(second).not.toHaveAttribute('data-dragging');
      expect(onDraggingChange).toHaveBeenCalledTimes(1);
      expect(grows('a', 'b', 'c')).toEqual(['33.334', '33.333', '33.333']);
    });

    it('starts a drag of the other handle when the first drag ended', async () => {
      await render(<Three />);

      await drag('handle-a', 100);
      await drag('handle-b', 100);

      expect(grows('a', 'b', 'c')).toEqual(['43.334', '33.333', '23.333']);
    });

    it('ends the drag when the handle unmounts', async () => {
      const showHandle = shallowRef(true);
      const onDraggingChange = vi.fn();
      const onLayoutCommitted = vi.fn();
      await render(() => (
        <div style={{ width: '1000px' }}>
          <Resizable.Root
            data-testid="root"
            onDraggingChange={onDraggingChange}
            onLayoutCommitted={onLayoutCommitted}
          >
            <Resizable.Panel id="a" />
            {showHandle.value ? <Resizable.Handle data-testid="handle" /> : null}
            <Resizable.Panel id="b" />
          </Resizable.Root>
        </div>
      ));
      const handle = screen.getByTestId('handle');
      await fireEvent.pointerDown(handle, { ...pointer, clientX: 0, buttons: 1 });
      await fireEvent.pointerMove(handle, { ...pointer, clientX: 100, buttons: 1 });

      showHandle.value = false;
      await nextTick();

      expect(screen.getByTestId('root')).not.toHaveAttribute('data-dragging');
      expect(onDraggingChange.mock.calls).toEqual([[true], [false]]);
      expect(onLayoutCommitted).toHaveBeenCalledTimes(1);
      // The commit has the last pointer event of the drag.
      expect(onLayoutCommitted.mock.calls[0]?.[1].event).toMatchObject({
        type: 'pointermove',
        clientX: 100,
      });
    });

    it('lets a handle of another root start its own drag', async () => {
      await render(
        <div style={{ width: '1000px' }}>
          <Resizable.Root>
            <Resizable.Panel />
            <Resizable.Handle data-testid="first" />
            <Resizable.Panel />
          </Resizable.Root>
          <Resizable.Root>
            <Resizable.Panel />
            <Resizable.Handle data-testid="second" />
            <Resizable.Panel />
          </Resizable.Root>
        </div>,
      );

      await fireEvent.pointerDown(screen.getByTestId('first'), {
        pointerId: 1,
        pointerType: 'mouse',
        buttons: 1,
      });
      await fireEvent.pointerDown(screen.getByTestId('second'), {
        pointerId: 2,
        pointerType: 'touch',
        buttons: 1,
      });

      expect(screen.getByTestId('first')).toHaveAttribute('data-dragging');
      expect(screen.getByTestId('second')).toHaveAttribute('data-dragging');
    });
  });

  describe('prop: disabled', () => {
    it('stops each handle', async () => {
      const onLayoutChange = vi.fn();
      await render(<Three root={{ disabled: true, onLayoutChange }} />);

      await drag('handle-a', 100);
      await drag('handle-b', 100);
      await fireEvent.keyDown(screen.getByTestId('handle-a'), { key: 'ArrowRight' });

      expect(onLayoutChange).not.toHaveBeenCalled();
    });

    it('still lets the app change the layout', async () => {
      const layout = shallowRef<Record<string, number>>({ a: 30, b: 30, c: 40 });
      await render(() => <Three root={{ disabled: true, layout: layout.value }} />);

      layout.value = { a: 10, b: 10, c: 80 };
      await nextTick();

      expect(grows('a', 'b', 'c')).toEqual(['10', '10', '80']);
    });
  });

  describe('elements that are not panels', () => {
    it('keep their size and are not in the panel space', async () => {
      const onLayoutChange = vi.fn();
      await render(
        <div style={{ width: '1000px' }}>
          <Resizable.Root onLayoutChange={onLayoutChange}>
            <Resizable.Panel id="a" data-testid="a" />
            <Resizable.Handle data-testid="handle" />
            <div data-testid="extra" style={{ width: '50px' }} />
            <Resizable.Panel id="b" data-testid="b" />
          </Resizable.Root>
        </div>,
      );
      expect(screen.getByTestId('extra').getBoundingClientRect().width).toBe(50);
      expect(screen.getByTestId('a').getBoundingClientRect().width).toBeCloseTo(475, 0);

      // The panel space is 950 px, so 95 px are 10%.
      await fireEvent.pointerDown(screen.getByTestId('handle'), {
        ...pointer,
        clientX: 0,
        buttons: 1,
      });
      await fireEvent.pointerMove(screen.getByTestId('handle'), {
        ...pointer,
        clientX: 95,
        buttons: 1,
      });

      expect(onLayoutChange).toHaveBeenCalledWith({ a: 60, b: 40 }, expect.anything());
      expect(screen.getByTestId('extra').getBoundingClientRect().width).toBe(50);
    });

    it('join the composite around the root, in a panel and as a child of the root', async () => {
      await render(
        <Toolbar.Root>
          <Resizable.Root>
            <Resizable.Panel>
              <Toolbar.Button data-testid="in-panel">In a panel</Toolbar.Button>
            </Resizable.Panel>
            <Toolbar.Button data-testid="in-root">In the root</Toolbar.Button>
            <Resizable.Handle data-testid="handle" />
            <Resizable.Panel>
              <Toolbar.Button data-testid="in-next-panel">In the next panel</Toolbar.Button>
            </Resizable.Panel>
          </Resizable.Root>
        </Toolbar.Root>,
      );
      const inPanel = screen.getByTestId('in-panel');
      inPanel.focus();

      await fireEvent.keyDown(inPanel, { key: 'ArrowRight' });
      expect(screen.getByTestId('in-root')).toHaveFocus();

      await fireEvent.keyDown(screen.getByTestId('in-root'), { key: 'ArrowRight' });
      expect(screen.getByTestId('in-next-panel')).toHaveFocus();
      expect(screen.getByTestId('handle')).toHaveAttribute('aria-valuenow', '50');
    });
  });

  describe('panels that mount and unmount', () => {
    it('gives a panel that mounts late its place in the document and a change with the reason none', async () => {
      const showMiddle = shallowRef(false);
      const onLayoutChange = vi.fn();
      await render(() => (
        <div style={{ width: '900px' }}>
          <Resizable.Root onLayoutChange={onLayoutChange}>
            <Resizable.Panel id="a" data-testid="a" />
            <Resizable.Handle data-testid="handle" />
            {showMiddle.value ? <Resizable.Panel id="middle" data-testid="middle" /> : null}
            <Resizable.Panel id="b" data-testid="b" />
          </Resizable.Root>
        </div>
      ));
      expect(onLayoutChange).not.toHaveBeenCalled();
      expect(grows('a', 'b')).toEqual(['50', '50']);

      showMiddle.value = true;
      await nextTick();
      await flushMicrotasks();

      const left = (testId: string) => screen.getByTestId(testId).getBoundingClientRect().left;
      expect(left('a')).toBeLessThan(left('middle'));
      expect(left('middle')).toBeLessThan(left('b'));
      expect(grows('a', 'middle', 'b')).toEqual(['33.334', '33.333', '33.333']);
      expect(onLayoutChange).toHaveBeenCalledTimes(1);
      expect(onLayoutChange).toHaveBeenCalledWith(
        { a: 33.334, middle: 33.333, b: 33.333 },
        expect.objectContaining({ reason: REASONS.none }),
      );
      // The handle is between the first panel and the middle panel.
      await waitFor(() => {
        expect(screen.getByTestId('handle')).toHaveAttribute('aria-controls', 'a');
      });
    });

    it('emits a change for a panel that mounts late with the id constructor', async () => {
      const showLate = shallowRef(false);
      const onLayoutChange = vi.fn();
      await render(() => (
        <div style={{ width: '1000px' }}>
          <Resizable.Root defaultLayout={{ a: 50, b: 50 }} onLayoutChange={onLayoutChange}>
            <Resizable.Panel id="a" />
            <Resizable.Panel id="b" />
            {showLate.value ? <Resizable.Panel id="constructor" /> : null}
          </Resizable.Root>
        </div>
      ));

      showLate.value = true;
      await nextTick();
      await flushMicrotasks();

      // An object has a `constructor` key, but the layout does not name the panel.
      expect(onLayoutChange).toHaveBeenCalledTimes(1);
      expect(onLayoutChange).toHaveBeenCalledWith(
        { a: 33.334, b: 33.333, constructor: 33.333 },
        expect.objectContaining({ reason: REASONS.none }),
      );
    });

    it('lets a listener cancel the change of a panel that mounts', async () => {
      const showMiddle = shallowRef(false);
      const onUpdate = vi.fn();
      await render(() => (
        <div style={{ width: '900px' }}>
          <Resizable.Root
            onLayoutChange={(_layout: unknown, details: { cancel: () => void }) => {
              details.cancel();
            }}
            {...{ 'onUpdate:layout': onUpdate }}
          >
            <Resizable.Panel id="a" data-testid="a" />
            {showMiddle.value ? <Resizable.Panel id="middle" data-testid="middle" /> : null}
            <Resizable.Panel id="b" data-testid="b" />
          </Resizable.Root>
        </div>
      ));

      showMiddle.value = true;
      await nextTick();

      expect(onUpdate).not.toHaveBeenCalled();
      expect(grows('a', 'middle', 'b')).toEqual(['33.334', '33.333', '33.333']);
    });

    it('gives the space of a panel that unmounts to the others, and gives it back when the panel mounts again', async () => {
      const showC = shallowRef(true);
      const onLayoutChange = vi.fn();
      await render(() => (
        <div style={{ width: '1000px' }}>
          <Resizable.Root defaultLayout={{ a: 60, b: 20, c: 20 }} onLayoutChange={onLayoutChange}>
            <Resizable.Panel id="a" data-testid="a" />
            <Resizable.Handle />
            <Resizable.Panel id="b" data-testid="b" />
            {showC.value ? <Resizable.Panel id="c" data-testid="c" /> : null}
          </Resizable.Root>
        </div>
      ));
      expect(grows('a', 'b', 'c')).toEqual(['60', '20', '20']);

      showC.value = false;
      await nextTick();
      expect(grows('a', 'b')).toEqual(['75', '25']);

      showC.value = true;
      await nextTick();

      expect(grows('a', 'b', 'c')).toEqual(['60', '20', '20']);
      expect(onLayoutChange).not.toHaveBeenCalled();
    });

    it('keeps the entry of a panel that is not mounted in the layout that a drag gives', async () => {
      const showC = shallowRef(false);
      const onLayoutChange = vi.fn();
      await render(() => (
        <div style={{ width: '1000px' }}>
          <Resizable.Root defaultLayout={{ a: 60, b: 20, c: 20 }} onLayoutChange={onLayoutChange}>
            <Resizable.Panel id="a" data-testid="a" />
            <Resizable.Handle data-testid="handle" />
            <Resizable.Panel id="b" data-testid="b" />
            {showC.value ? <Resizable.Panel id="c" data-testid="c" /> : null}
          </Resizable.Root>
        </div>
      ));
      expect(grows('a', 'b')).toEqual(['75', '25']);

      await drag('handle', 100);
      expect(grows('a', 'b')).toEqual(['85', '15']);
      expect(onLayoutChange).toHaveBeenLastCalledWith({ a: 68, b: 12, c: 20 }, expect.anything());

      showC.value = true;
      await nextTick();

      expect(grows('a', 'b', 'c')).toEqual(['68', '12', '20']);
    });

    it('emits no change when a panel unmounts, and one change when a panel that the layout does not name mounts', async () => {
      const showC = shallowRef(true);
      const onLayoutChange = vi.fn();
      await render(() => (
        <div style={{ width: '1000px' }}>
          <Resizable.Root onLayoutChange={onLayoutChange}>
            <Resizable.Panel id="a" data-testid="a" />
            <Resizable.Panel id="b" data-testid="b" />
            {showC.value ? <Resizable.Panel id="c" data-testid="c" /> : null}
          </Resizable.Root>
        </div>
      ));

      showC.value = false;
      await nextTick();
      expect(grows('a', 'b')).toEqual(['50', '50']);
      expect(onLayoutChange).not.toHaveBeenCalled();
      showC.value = true;
      await nextTick();

      expect(onLayoutChange).toHaveBeenCalledTimes(1);
      expect(onLayoutChange).toHaveBeenCalledWith(
        { a: 33.334, b: 33.333, c: 33.333 },
        expect.objectContaining({ reason: REASONS.none }),
      );
    });

    it('emits no change when a handle mounts, and one change for each panel that the layout does not name', async () => {
      const showHandle = shallowRef(false);
      const showPanel = shallowRef(false);
      const onLayoutChange = vi.fn();
      await render(() => (
        <div style={{ width: '1000px' }}>
          <Resizable.Root defaultLayout={{ a: 60, b: 40 }} onLayoutChange={onLayoutChange}>
            <Resizable.Panel id="a" />
            {showHandle.value ? <Resizable.Handle /> : null}
            <Resizable.Panel id="b" />
            {showPanel.value ? <Resizable.Panel id="c" /> : null}
          </Resizable.Root>
        </div>
      ));

      showHandle.value = true;
      await nextTick();
      await flushMicrotasks();
      expect(onLayoutChange).not.toHaveBeenCalled();

      showPanel.value = true;
      await nextTick();
      await flushMicrotasks();

      expect(onLayoutChange).toHaveBeenCalledTimes(1);
      expect(onLayoutChange).toHaveBeenCalledWith(
        { a: 40, b: 26.667, c: 33.333 },
        expect.objectContaining({ reason: REASONS.none }),
      );
    });

    it('sees a panel whose id changes as a panel that mounts', async () => {
      const id = shallowRef('a');
      const onLayoutChange = vi.fn();
      await render(() => (
        <div style={{ width: '1000px' }}>
          <Resizable.Root defaultLayout={{ a: 70, b: 30 }} onLayoutChange={onLayoutChange}>
            <Resizable.Panel id={id.value} data-testid="first" />
            <Resizable.Panel id="b" data-testid="b" />
          </Resizable.Root>
        </div>
      ));
      expect(screen.getByTestId('first').style.flexGrow).toBe('70');

      id.value = 'renamed';
      await nextTick();
      await flushMicrotasks();

      expect(screen.getByTestId('first')).toHaveAttribute('id', 'renamed');
      expect(onLayoutChange).toHaveBeenCalledTimes(1);
      // The panel with the new id has no entry. The old entry stays for a panel that comes back,
      // and the panels that are mounted share the rest.
      expect(onLayoutChange.mock.calls[0]?.[0]).toEqual({ a: 70, renamed: 21, b: 9 });
      expect(onLayoutChange.mock.calls[0]?.[1].reason).toBe(REASONS.none);
    });

    it('mounts and unmounts a handle with its panel', async () => {
      const showLast = shallowRef(true);
      await render(() => (
        <div style={{ width: '1000px' }}>
          <Resizable.Root>
            <Resizable.Panel id="a" data-testid="a" />
            <Resizable.Handle data-testid="first" />
            <Resizable.Panel id="b" data-testid="b" />
            {showLast.value
              ? [
                  <Resizable.Handle key="handle" data-testid="second" />,
                  <Resizable.Panel key="panel" id="c" data-testid="c" />,
                ]
              : null}
          </Resizable.Root>
        </div>
      ));
      expect(screen.getByTestId('second')).toHaveAttribute('aria-valuenow', '33');

      showLast.value = false;
      await nextTick();
      expect(screen.queryByTestId('second')).toBeNull();
      expect(screen.getByTestId('first')).toHaveAttribute('aria-valuenow', '50');

      showLast.value = true;
      await nextTick();

      expect(screen.getByTestId('first')).toHaveAttribute('aria-valuenow', '33');
      expect(screen.getByTestId('second')).toHaveAttribute('aria-valuenow', '33');
    });

    it('keeps the size of each panel when a keyed list moves them', async () => {
      const ids = shallowRef(['a', 'b', 'c']);
      await render(() => (
        <div style={{ width: '1000px' }}>
          <Resizable.Root defaultLayout={{ a: 20, b: 30, c: 50 }}>
            {() =>
              ids.value.flatMap((id, index) => [
                index > 0 ? (
                  <Resizable.Handle key={`handle-${id}`} data-testid={`before-${id}`} />
                ) : null,
                <Resizable.Panel key={id} id={id} data-testid={id} />,
              ])
            }
          </Resizable.Root>
        </div>
      ));

      ids.value = ['c', 'a', 'b'];
      await nextTick();

      expect(grows('a', 'b', 'c')).toEqual(['20', '30', '50']);
      // The handle between the first two panels reports the first panel.
      await waitFor(() => {
        expect(screen.getByTestId('before-a')).toHaveAttribute('aria-controls', 'c');
      });
      expect(screen.getByTestId('before-a')).toHaveAttribute('aria-valuenow', '50');
      expect(screen.getByTestId('before-b')).toHaveAttribute('aria-controls', 'a');
    });
  });

  describe('nested roots', () => {
    it('keeps the layout of each root apart', async () => {
      const outerChange = vi.fn();
      const innerChange = vi.fn();
      await render(
        <div style={{ width: '1000px', height: '400px' }}>
          <Resizable.Root style={{ height: '100%' }} onLayoutChange={outerChange}>
            <Resizable.Panel id="outer-a" data-testid="outer-a" defaultSize={60} />
            <Resizable.Handle data-testid="outer-handle" />
            <Resizable.Panel id="outer-b" data-testid="outer-b">
              <Resizable.Root
                orientation="vertical"
                style={{ height: '100%' }}
                onLayoutChange={innerChange}
              >
                <Resizable.Panel id="inner-a" data-testid="inner-a" />
                <Resizable.Handle data-testid="inner-handle" />
                <Resizable.Panel id="inner-b" data-testid="inner-b" />
              </Resizable.Root>
            </Resizable.Panel>
          </Resizable.Root>
        </div>,
      );
      expect(screen.getByTestId('inner-handle')).toHaveAttribute('aria-controls', 'inner-a');
      expect(screen.getByTestId('outer-handle')).toHaveAttribute('aria-controls', 'outer-a');

      const inner = screen.getByTestId('inner-handle');
      await fireEvent.pointerDown(inner, { ...pointer, clientY: 0, buttons: 1 });
      await fireEvent.pointerMove(inner, { ...pointer, clientY: 40, buttons: 1 });
      await fireEvent.pointerUp(inner, { ...pointer, clientY: 40 });
      expect(innerChange).toHaveBeenCalledWith({ 'inner-a': 60, 'inner-b': 40 }, expect.anything());
      expect(outerChange).not.toHaveBeenCalled();

      await drag('outer-handle', 100);
      expect(outerChange).toHaveBeenCalledWith({ 'outer-a': 70, 'outer-b': 30 }, expect.anything());
      expect(innerChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('F6', () => {
    interface PanesOptions {
      root?: Record<string, unknown>;
      a?: unknown;
      b?: unknown;
      c?: unknown;
      panelB?: Record<string, unknown>;
    }

    // A listener on the document reads the key after each listener of the root. It then stops the
    // action of the browser: Firefox moves the focus out of the page for an F6 that no listener
    // prevented, and the focus of a later case then starts outside the page.
    function recordPrevented() {
      const prevented: boolean[] = [];
      const listener = (event: KeyboardEvent) => {
        if (event.key === 'F6') {
          prevented.push(event.defaultPrevented);
          event.preventDefault();
        }
      };
      document.addEventListener('keydown', listener);
      onTestFinished(() => {
        document.removeEventListener('keydown', listener);
      });
      return prevented;
    }

    // Each case presses a real key, so each engine gets the key as a user gives it. The result is
    // the record of `recordPrevented`.
    async function renderPanes({
      root,
      a = <button type="button">A</button>,
      b = <button type="button">B</button>,
      c = <button type="button">C</button>,
      panelB,
    }: PanesOptions = {}) {
      const prevented = recordPrevented();
      await render(
        <div style={{ width: '1000px' }}>
          <Resizable.Root data-testid="root" {...root}>
            <Resizable.Panel id="a" data-testid="a">
              {a}
            </Resizable.Panel>
            <Resizable.Handle data-testid="handle-a" aria-label="Resize a" />
            <Resizable.Panel id="b" data-testid="b" {...panelB}>
              {b}
            </Resizable.Panel>
            <Resizable.Handle data-testid="handle-b" aria-label="Resize b" />
            <Resizable.Panel id="c" data-testid="c">
              {c}
            </Resizable.Panel>
          </Resizable.Root>
        </div>,
      );
      return prevented;
    }

    const button = (name: string) => screen.getByRole('button', { name });

    it('VUE-138: moves focus to the next panel on F6 from a button in a panel slot', async () => {
      const first = document.createElement('button');
      const root = createSlotHost(first);
      await render(
        <Teleport to={root}>
          <Resizable.Root>
            <Resizable.Panel>{h('slot')}</Resizable.Panel>
            <Resizable.Handle aria-label="Resize" />
            <Resizable.Panel>
              <button>Next</button>
            </Resizable.Panel>
          </Resizable.Root>
        </Teleport>,
      );
      first.focus();
      await userEvent.keyboard('{F6}');
      expect(root.activeElement?.textContent).toBe('Next');
    });

    it.each([
      { name: 'F6 from a control', from: 'B', keys: '{F6}', to: 'C' },
      { name: 'Shift+F6 from a control', from: 'B', keys: '{Shift>}{F6}{/Shift}', to: 'A' },
      { name: 'F6 from a handle', from: 'handle-a', keys: '{F6}', to: 'B' },
      { name: 'Shift+F6 from a handle', from: 'handle-a', keys: '{Shift>}{F6}{/Shift}', to: 'A' },
    ])('moves the focus to the next pane: $name', async ({ from, keys, to }) => {
      const prevented = await renderPanes();
      (from.startsWith('handle') ? screen.getByTestId(from) : button(from)).focus();

      await userEvent.keyboard(keys);

      expect(button(to)).toHaveFocus();
      expect(prevented).toEqual([true]);
    });

    it('passes over a panel with no tabbable element', async () => {
      await renderPanes({ b: 'Text' });
      button('A').focus();

      await userEvent.keyboard('{F6}');

      expect(button('C')).toHaveFocus();
    });

    it('passes over a panel whose size is 0', async () => {
      const instance: { current?: InstanceType<typeof Resizable.Panel> } = {};
      await render(() => (
        <div style={{ width: '1000px' }}>
          <Resizable.Root>
            <Resizable.Panel id="a">
              <button type="button">A</button>
            </Resizable.Panel>
            <Resizable.Handle aria-label="Resize a" />
            <Resizable.Panel
              id="b"
              data-testid="b"
              collapsible
              collapsedSize={0}
              minSize={10}
              ref={(value: unknown) => {
                instance.current = value as InstanceType<typeof Resizable.Panel>;
              }}
            >
              <button type="button">B</button>
            </Resizable.Panel>
            <Resizable.Handle aria-label="Resize b" />
            <Resizable.Panel id="c">
              <button type="button">C</button>
            </Resizable.Panel>
          </Resizable.Root>
        </div>
      ));
      instance.current?.collapse();
      await nextTick();
      expect(screen.getByTestId('b').style.flexGrow).toBe('0');
      button('A').focus();

      await userEvent.keyboard('{F6}');

      expect(button('C')).toHaveFocus();
    });

    it('wraps from the last panel to the first, and back with Shift+F6', async () => {
      await renderPanes();
      button('C').focus();

      await userEvent.keyboard('{F6}');

      expect(button('A')).toHaveFocus();

      await userEvent.keyboard('{Shift>}{F6}{/Shift}');

      expect(button('C')).toHaveFocus();
    });

    it('gives the key to the outer root at the last panel of a nested root', async () => {
      await renderPanes({
        b: (
          <Resizable.Root orientation="vertical" style={{ height: '200px' }}>
            <Resizable.Panel id="inner-a">
              <button type="button">Inner A</button>
            </Resizable.Panel>
            <Resizable.Handle aria-label="Resize inner a" />
            <Resizable.Panel id="inner-b">
              <button type="button">Inner B</button>
            </Resizable.Panel>
          </Resizable.Root>
        ),
      });
      button('Inner B').focus();

      await userEvent.keyboard('{F6}');

      expect(button('C')).toHaveFocus();

      button('Inner A').focus();

      await userEvent.keyboard('{F6}');

      expect(button('Inner B')).toHaveFocus();
    });

    it('wraps in a root that a Teleport moves out of the outer root', async () => {
      await renderPanes({
        b: (
          <Teleport to="body">
            <div style={{ width: '400px' }}>
              <Resizable.Root>
                <Resizable.Panel id="moved-a">
                  <button type="button">Moved A</button>
                </Resizable.Panel>
                <Resizable.Handle aria-label="Resize moved a" />
                <Resizable.Panel id="moved-b">
                  <button type="button">Moved B</button>
                </Resizable.Panel>
              </Resizable.Root>
            </div>
          </Teleport>
        ),
      });
      button('Moved B').focus();

      await userEvent.keyboard('{F6}');

      expect(button('Moved A')).toHaveFocus();
    });

    it('wraps in a root that is in an element of the outer root that is not a panel', async () => {
      const prevented = recordPrevented();
      await render(
        <div style={{ width: '1000px' }}>
          <Resizable.Root>
            <Resizable.Panel id="a">
              <button type="button">A</button>
            </Resizable.Panel>
            <Resizable.Handle aria-label="Resize a" />
            <Resizable.Panel id="b">
              <button type="button">B</button>
            </Resizable.Panel>
            <div style={{ width: '400px' }}>
              <Resizable.Root>
                <Resizable.Panel id="side-a">
                  <button type="button">Side A</button>
                </Resizable.Panel>
                <Resizable.Handle aria-label="Resize side a" />
                <Resizable.Panel id="side-b">
                  <button type="button">Side B</button>
                </Resizable.Panel>
              </Resizable.Root>
            </div>
          </Resizable.Root>
        </div>,
      );
      button('Side B').focus();

      await userEvent.keyboard('{F6}');

      expect(button('Side A')).toHaveFocus();
      expect(prevented).toEqual([true]);
    });

    it('does not prevent the key when no pane has a control', async () => {
      const prevented = await renderPanes({ a: 'A', b: 'B', c: 'C' });
      const handle = screen.getByTestId('handle-a');
      handle.focus();

      await userEvent.keyboard('{F6}');

      expect(handle).toHaveFocus();
      expect(prevented).toEqual([false]);
    });

    it('does nothing when a listener prevented the key', async () => {
      await renderPanes({
        b: (
          <button
            type="button"
            onKeydown={(event: KeyboardEvent) => {
              event.preventDefault();
            }}
          >
            B
          </button>
        ),
      });
      button('B').focus();

      await userEvent.keyboard('{F6}');

      expect(button('B')).toHaveFocus();
    });

    it('does nothing when a keydown listener on the root calls preventVaseUIHandler', async () => {
      const prevented = await renderPanes({
        root: {
          onKeydown: (event: KeyboardEvent & { preventVaseUIHandler: () => void }) => {
            event.preventVaseUIHandler();
          },
        },
      });
      button('B').focus();

      await userEvent.keyboard('{F6}');

      expect(button('B')).toHaveFocus();
      expect(prevented).toEqual([false]);
    });

    it.each([
      { name: 'Control', keys: '{Control>}{F6}{/Control}' },
      { name: 'Alt', keys: '{Alt>}{F6}{/Alt}' },
      { name: 'Meta', keys: '{Meta>}{F6}{/Meta}' },
    ])('does nothing with F6 and $name', async ({ keys }) => {
      const prevented = await renderPanes();
      button('B').focus();

      await userEvent.keyboard(keys);

      expect(button('B')).toHaveFocus();
      expect(prevented).toEqual([false]);
    });

    it('moves the focus in a disabled root', async () => {
      await renderPanes({ root: { disabled: true } });
      button('A').focus();

      await userEvent.keyboard('{F6}');

      expect(button('B')).toHaveFocus();
    });
  });

  describe('KeepAlive', () => {
    it('ends a drag when the root is deactivated', async () => {
      const Layout = defineComponent({
        setup(_props, { attrs }) {
          return () => (
            <div style={{ width: '1000px' }}>
              <Resizable.Root {...attrs}>
                <Resizable.Panel />
                <Resizable.Handle data-testid="handle" />
                <Resizable.Panel />
              </Resizable.Root>
            </div>
          );
        },
      });
      const Other = defineComponent({ setup: () => () => <p>Other</p> });
      const active = shallowRef(true);
      const onDraggingChange = vi.fn();
      const onLayoutCommitted = vi.fn();
      await render(() => (
        <KeepAlive>
          {active.value ? (
            <Layout key="layout" {...{ onDraggingChange, onLayoutCommitted }} />
          ) : (
            <Other key="other" />
          )}
        </KeepAlive>
      ));
      const handle = screen.getByTestId('handle');
      await fireEvent.pointerDown(handle, { ...pointer, clientX: 0, buttons: 1 });
      await fireEvent.pointerMove(handle, { ...pointer, clientX: 100, buttons: 1 });

      active.value = false;
      await nextTick();
      expect(onDraggingChange.mock.calls).toEqual([[true], [false]]);
      expect(onLayoutCommitted).toHaveBeenCalledTimes(1);

      active.value = true;
      await nextTick();

      expect(screen.getByTestId('handle')).not.toHaveAttribute('data-dragging');
    });

    // The panels stay in the document, so the handle keeps its panel on each side.
    it('ends the press before the parent receives its deactivation hook', async () => {
      const show = shallowRef(true);
      const dragging = vi.fn();
      const atHold = vi.fn();
      const Handle = defineComponent(() => {
        onDeactivated(() => atHold(dragging.mock.lastCall));
        return () => <Resizable.Handle data-testid="handle" />;
      });
      await render(() => (
        <Resizable.Root onDraggingChange={dragging}>
          <Resizable.Panel id="a" />
          <KeepAlive>{show.value ? <Handle /> : null}</KeepAlive>
          <Resizable.Panel id="b" />
        </Resizable.Root>
      ));
      await fireEvent.pointerDown(screen.getByTestId('handle'), { ...pointer, buttons: 1 });
      expect(dragging).toHaveBeenLastCalledWith(true);

      show.value = false;
      await nextTick();
      expect(atHold).toHaveBeenCalledExactlyOnceWith([false]);
    });

    it('ends a drag when KeepAlive holds the handle', async () => {
      const Handle = defineComponent({
        setup: () => () => <Resizable.Handle data-testid="handle" />,
      });
      const showHandle = shallowRef(true);
      const onDraggingChange = vi.fn();
      await render(() => (
        <div style={{ width: '1000px' }}>
          <Resizable.Root onDraggingChange={onDraggingChange}>
            <Resizable.Panel />
            <KeepAlive>{showHandle.value ? <Handle /> : null}</KeepAlive>
            <Resizable.Panel />
          </Resizable.Root>
        </div>
      ));
      const handle = screen.getByTestId('handle');
      await fireEvent.pointerDown(handle, { ...pointer, clientX: 0, buttons: 1 });
      await fireEvent.pointerMove(handle, { ...pointer, clientX: 100, buttons: 1 });

      showHandle.value = false;
      await nextTick();

      expect(onDraggingChange.mock.calls).toEqual([[true], [false]]);
    });

    it('gives the space of a panel that it holds to the other panels, and gives it back', async () => {
      const Side = defineComponent({
        setup: () => () => <Resizable.Panel id="c" data-testid="c" />,
      });
      const showC = shallowRef(true);
      const onLayoutChange = vi.fn();
      await render(() => (
        <div style={{ width: '1000px' }}>
          <Resizable.Root defaultLayout={{ a: 60, b: 20, c: 20 }} onLayoutChange={onLayoutChange}>
            <Resizable.Panel id="a" data-testid="a" />
            <Resizable.Handle data-testid="handle-a" />
            <Resizable.Panel id="b" data-testid="b" />
            <Resizable.Handle data-testid="handle-b" primaryPanel="next" />
            <KeepAlive>{showC.value ? <Side /> : null}</KeepAlive>
          </Resizable.Root>
        </div>
      ));
      const handle = screen.getByTestId('handle-b');
      expect(handle).toHaveAttribute('aria-controls', 'c');

      showC.value = false;
      await nextTick();
      expect(grows('a', 'b')).toEqual(['75', '25']);
      expect(screen.getByTestId('handle-a')).toHaveAttribute('aria-valuenow', '75');
      // The handle has no panel after it, so it does not name the panel that is not in the page.
      expect(handle).not.toHaveAttribute('aria-controls');

      showC.value = true;
      await nextTick();

      expect(grows('a', 'b', 'c')).toEqual(['60', '20', '20']);
      expect(handle).toHaveAttribute('aria-controls', 'c');
      expect(onLayoutChange).not.toHaveBeenCalled();
    });

    it('emits no change when the root shows again', async () => {
      const active = shallowRef(true);
      const onLayoutChange = vi.fn();
      const Layout = defineComponent({
        setup: () => () => <Three root={{ onLayoutChange }} />,
      });
      const Other = defineComponent({ setup: () => () => <p>Other</p> });
      await render(() => (
        <KeepAlive>{active.value ? <Layout key="layout" /> : <Other key="other" />}</KeepAlive>
      ));

      active.value = false;
      await nextTick();
      active.value = true;
      await nextTick();
      await flushMicrotasks();

      expect(grows('a', 'b', 'c')).toEqual(['33.334', '33.333', '33.333']);
      expect(onLayoutChange).not.toHaveBeenCalled();
    });

    it('gives no room to a panel that mounts while KeepAlive holds it', async () => {
      const onLayoutChange = vi.fn();
      const { HeldBranch, mountWhileHeld, show } = createHeldBranch(
        () => <Resizable.Panel id="c" data-testid="c" />,
        { renderBranch: (part) => part },
      );
      await render(
        <div style={{ width: '1000px' }}>
          <Resizable.Root defaultLayout={{ a: 60, b: 20, c: 20 }} onLayoutChange={onLayoutChange}>
            <Resizable.Panel id="a" data-testid="a" />
            <Resizable.Handle data-testid="handle-a" />
            <Resizable.Panel id="b" data-testid="b" />
            <Resizable.Handle data-testid="handle-b" primaryPanel="next" />
            <HeldBranch />
          </Resizable.Root>
        </div>,
      );
      const handle = screen.getByTestId('handle-b');

      await mountWhileHeld();

      expect(grows('a', 'b')).toEqual(['75', '25']);
      expect(handle).not.toHaveAttribute('aria-controls');
      expect(onLayoutChange).not.toHaveBeenCalled();

      await show();

      expect(grows('a', 'b', 'c')).toEqual(['60', '20', '20']);
      expect(handle).toHaveAttribute('aria-controls', 'c');
      expect(onLayoutChange).not.toHaveBeenCalled();
    });

    it.each([
      {
        name: 'mounts while held',
        mount: async (branch: ReturnType<typeof createHeldBranch>) => {
          await branch.mountWhileHeld();
          await branch.show();
        },
      },
      {
        name: 'mounts in the show from a state',
        mount: async (branch: ReturnType<typeof createHeldBranch>) => {
          await branch.hide();
          await branch.mountInActivation();
        },
      },
      {
        name: 'mounts in the show from a prop',
        mount: async (branch: ReturnType<typeof createHeldBranch>) => {
          await branch.hide();
          await branch.mountInActivation({ fromProp: true });
        },
      },
    ])('emits no change at the first show of a root that $name', async ({ mount }) => {
      const onLayoutChange = vi.fn();
      const branch = createHeldBranch(() => <Three root={{ onLayoutChange }} />);
      await render(<branch.HeldBranch />);

      await mount(branch);
      await waitSingleFrame();

      expect(grows('a', 'b', 'c')).toEqual(['33.334', '33.333', '33.333']);
      expect(onLayoutChange).not.toHaveBeenCalled();
      expect(screen.getByTestId('handle-a')).toHaveAttribute('aria-valuenow', '33');
      expect(screen.getByTestId('handle-b')).toHaveAttribute('aria-valuenow', '33');
    });
  });

  describe('server render', () => {
    const growsIn = (container: HTMLElement) =>
      Array.from(container.querySelectorAll<HTMLElement>('[id]')).map(
        (panel) => panel.style.flexGrow,
      );

    it.each([
      {
        name: 'the defaults of three panels',
        composition: 'defaults',
        grows: ['30', '35', '35'],
      },
      { name: 'the layout of the root', composition: 'layout', grows: ['20', '80'] },
      {
        name: 'a panel in a component and a nested root',
        composition: 'nested',
        grows: ['30', '70', '25', '75'],
      },
      { name: 'a vertical root', composition: 'vertical', grows: ['40', '60'] },
      { name: 'a collapsed panel', composition: 'collapsed', grows: ['0', '100'] },
      { name: 'the style of a consumer', composition: 'style', grows: ['30', '70'] },
      { name: 'a handle before the first panel', composition: 'handleFirst', grows: ['50', '50'] },
      { name: 'a hit area size in a number', composition: 'hitAreaNumber', grows: ['50', '50'] },
      { name: 'a root with dragEdges', composition: 'edges', grows: ['50', '50'] },
    ])('hydrates $name with no warning and no mismatch left', async ({ composition, grows }) => {
      const props = { composition };
      const serverHtml = await renderOnServer(
        'src/resizable/root/ResizableRootHydration.test.vue',
        props,
      );

      const { container } = await hydrate(ResizableRootHydration, { serverHtml, props });

      expect(growsIn(container)).toEqual(grows);
    });

    it('renders the edge node of a root with dragEdges after the mount, and not before', async () => {
      const props = { composition: 'edges' };
      const serverHtml = await renderOnServer(
        'src/resizable/root/ResizableRootHydration.test.vue',
        props,
      );
      expect(serverHtml).not.toContain('data-vase-ui-resizable-edge');

      const { container } = await hydrate(ResizableRootHydration, { serverHtml, props });

      await waitFor(() => {
        expect(container.querySelectorAll('[data-vase-ui-resizable-edge]')).toHaveLength(1);
      });
      expect(container.querySelector('[data-testid="root"]')).toHaveStyle({ position: 'relative' });
    });

    it('hydrates the fine hit area size of the server, and gives the coarse size after the mount', async () => {
      const { matchMedia } = window;
      window.matchMedia = (query: string) =>
        ({
          matches: query === '(pointer: coarse)',
          media: query,
          addEventListener() {},
          removeEventListener() {},
        }) as unknown as MediaQueryList;
      onTestFinished(() => {
        window.matchMedia = matchMedia;
      });
      const props = { composition: 'hitAreaObject' };
      const serverHtml = await renderOnServer(
        'src/resizable/root/ResizableRootHydration.test.vue',
        props,
      );
      expect(serverHtml).toContain('width:max(100%, 12px)');

      const { container } = await hydrate(ResizableRootHydration, { serverHtml, props });

      const area = container.querySelector<HTMLElement>('[data-vase-ui-resizable-hit-area]');
      expect(area?.style.width).toBe('max(100%, 30px)');
    });

    it('has the state of the collapsed panel and of the handle after the hydration', async () => {
      const props = { composition: 'collapsed' };
      const serverHtml = await renderOnServer(
        'src/resizable/root/ResizableRootHydration.test.vue',
        props,
      );

      const { container } = await hydrate(ResizableRootHydration, { serverHtml, props });

      expect(container.querySelector('#a')).toHaveAttribute('data-collapsed');
      expect(container.querySelector('#b')).not.toHaveAttribute('data-collapsed');
      expect(container.querySelector('[role="separator"]')).toHaveAttribute('data-at-min');
      expect(container.querySelector('[role="separator"]')).not.toHaveAttribute('data-at-max');
    });

    it('keeps the style of a consumer after the hydration', async () => {
      const props = { composition: 'style' };
      const serverHtml = await renderOnServer(
        'src/resizable/root/ResizableRootHydration.test.vue',
        props,
      );

      const { container } = await hydrate(ResizableRootHydration, { serverHtml, props });

      expect(container.querySelector<HTMLElement>('#a')?.style.color).toBe('red');
      expect(container.querySelector<HTMLElement>('#b')?.style.padding).toBe('4px');
    });

    it('does not move a panel at the hydration', async () => {
      const props = { composition: 'defaults' };
      const serverHtml = await renderOnServer(
        'src/resizable/root/ResizableRootHydration.test.vue',
        props,
      );
      const container = document.createElement('div');
      container.style.width = '1000px';
      document.body.append(container);
      container.innerHTML = serverHtml;
      const widths = () =>
        Array.from(container.querySelectorAll<HTMLElement>('[id]')).map(
          (panel) => panel.getBoundingClientRect().width,
        );
      const before = widths();
      expect(before[0]).toBeCloseTo(300, 0);

      const app = createSSRApp(ResizableRootHydration, props);
      onTestFinished(() => {
        app.unmount();
        container.remove();
      });
      app.mount(container);
      await nextTick();

      expect(widths()).toEqual(before);
      expect(takeReportedMessages()).toEqual([]);
    });

    it.each([
      { name: 'a size of a panel in pixels', composition: 'length' },
      { name: 'a size of the layout in rem', composition: 'layoutLength' },
      { name: 'a length and the size of another panel', composition: 'lengthMixed' },
      { name: 'a fixed panel', composition: 'fixed' },
    ])('hydrates $name with no warning and no mismatch left', async ({ composition }) => {
      const props = { composition };
      const serverHtml = await renderOnServer(
        'src/resizable/root/ResizableRootHydration.test.vue',
        props,
      );

      const { container } = await hydrate(ResizableRootHydration, { serverHtml, props });

      // The root has read the page, so a panel has its size in percent and the handle has its value.
      expect(container.querySelector<HTMLElement>('#a')?.style.flexGrow).not.toBe('0');
      expect(container.querySelector('[role="separator"]')).toHaveAttribute('aria-valuenow');
    });

    it.each([
      {
        name: 'a size of a panel',
        composition: 'length',
        widths: [240, 760],
      },
      {
        name: 'a size of the layout',
        composition: 'layoutLength',
        widths: [15 * Number.parseFloat(getComputedStyle(document.documentElement).fontSize), 0],
      },
    ])('does not move a panel with $name at the hydration', async ({ composition, widths }) => {
      const props = { composition };
      const serverHtml = await renderOnServer(
        'src/resizable/root/ResizableRootHydration.test.vue',
        props,
      );
      const container = document.createElement('div');
      container.style.width = '1000px';
      document.body.append(container);
      container.innerHTML = serverHtml;
      const widthsNow = () =>
        Array.from(container.querySelectorAll<HTMLElement>('[id]')).map(
          (panel) => panel.getBoundingClientRect().width,
        );
      // The server HTML has the length that the panel asked for, before any script runs.
      const before = widthsNow();
      expect(before[0]).toBeCloseTo(widths[0] ?? 0, 0);
      expect(container.querySelector('[role="separator"]')).not.toHaveAttribute('aria-valuenow');

      const app = createSSRApp(ResizableRootHydration, props);
      onTestFinished(() => {
        app.unmount();
        container.remove();
      });
      app.mount(container);
      await nextTick();

      for (const [index, width] of widthsNow().entries()) {
        expect(width).toBeCloseTo(before[index] ?? 0, 0);
      }
      expect(container.querySelector('[role="separator"]')).toHaveAttribute('aria-valuenow');
      expect(takeReportedMessages()).toEqual([]);
    });

    it('keeps a panel with a length inside a root that is narrower, before the hydration', async () => {
      const props = { composition: 'length' };
      const serverHtml = await renderOnServer(
        'src/resizable/root/ResizableRootHydration.test.vue',
        props,
      );
      const container = document.createElement('div');
      container.style.width = '200px';
      document.body.append(container);
      container.innerHTML = serverHtml;
      const panel = container.querySelector<HTMLElement>('#a');
      // The panel shrinks to the root: it is 200 px and not 240 px, so it does not overflow.
      expect(panel?.getBoundingClientRect().width).toBeCloseTo(200, 0);

      const app = createSSRApp(ResizableRootHydration, props);
      onTestFinished(() => {
        app.unmount();
        container.remove();
      });
      app.mount(container);
      await nextTick();

      expect(container.querySelector('#a')).toBe(panel);
      expect(takeReportedMessages()).toEqual([]);
    });

    it('gives each panel the layout of all three after it hydrates a panel below an async setup', async () => {
      const serverHtml = await renderOnServer('src/resizable/root/ResizableRootLatePanel.test.vue');
      const container = document.createElement('div');
      document.body.append(container);
      container.innerHTML = serverHtml;
      const panel = within(container).getByTestId('a');
      expect(panel.style.flexGrow).toBe('50');

      // The `hydrate` helper waits two ticks, and a panel below `<Suspense>` hydrates later.
      const app = createSSRApp(ResizableRootLatePanel);
      onTestFinished(() => {
        app.unmount();
        container.remove();
      });
      app.mount(container);

      await waitFor(() => {
        expect(panel.style.flexGrow).toBe('33.334');
      });
      expect(within(container).getByTestId('b').style.flexGrow).toBe('33.333');
      expect(within(container).getByTestId('late').style.flexGrow).toBe('33.333');
      expect(within(container).getByTestId('a')).toBe(panel);
      expect(takeReportedMessages()).toEqual([]);
    });
  });

  describe('prop: pushPanels', () => {
    // The middle panel has a least size of 20, so a move of the first handle goes on into the last
    // panel only when the root pushes the panels.
    function Pushing(props: { pushPanels: boolean }) {
      return (
        <div style={{ width: '1000px' }}>
          <Resizable.Root pushPanels={props.pushPanels} defaultLayout={{ a: 30, b: 30, c: 40 }}>
            <Resizable.Panel id="a" data-testid="a" />
            <Resizable.Handle data-testid="handle-a" />
            <Resizable.Panel id="b" data-testid="b" minSize={20} />
            <Resizable.Handle data-testid="handle-b" />
            <Resizable.Panel id="c" data-testid="c" />
          </Resizable.Root>
        </div>
      );
    }

    it.each([
      { name: 'pushes the next panel', pushPanels: true, expected: ['60', '20', '20'] },
      { name: 'stops at the next panel', pushPanels: false, expected: ['40', '20', '40'] },
    ])('a drag $name', async ({ pushPanels, expected }) => {
      await render(<Pushing pushPanels={pushPanels} />);

      await drag('handle-a', 300);

      expect(grows('a', 'b', 'c')).toEqual(expected);
    });

    it.each([
      { name: 'pushes the next panel', pushPanels: true, expected: ['50', '20', '30'] },
      { name: 'stops at the next panel', pushPanels: false, expected: ['40', '20', '40'] },
    ])('a key $name', async ({ pushPanels, expected }) => {
      const { user } = await render(<Pushing pushPanels={pushPanels} />);
      screen.getByTestId('handle-a').focus();

      await user.keyboard('{Shift>}{ArrowRight}{ArrowRight}{/Shift}');

      expect(grows('a', 'b', 'c')).toEqual(expected);
    });

    it.each([
      { name: 'counts the next panels', pushPanels: true, max: '80' },
      { name: 'counts the next panel only', pushPanels: false, max: '40' },
    ])('has an aria-valuemax that $name', async ({ pushPanels, max }) => {
      await render(<Pushing pushPanels={pushPanels} />);

      expect(screen.getByTestId('handle-a')).toHaveAttribute('aria-valuemax', max);
    });
  });

  describe('methods', () => {
    type RootInstance = InstanceType<typeof Resizable.Root>;

    // The methods come through a template ref, which a vnode makes only in a render function.
    async function renderRoot(root: Record<string, unknown> = {}) {
      const instance: { current?: RootInstance } = {};
      await render(() => (
        <Three
          root={{
            ref: (value: unknown) => {
              instance.current = value as RootInstance;
            },
            ...root,
          }}
        />
      ));
      return () => {
        if (!instance.current) {
          throw new Error('The root is not mounted.');
        }
        return instance.current;
      };
    }

    it('gives a copy of the layout that the panels show with getLayout()', async () => {
      const getRoot = await renderRoot({ defaultLayout: { a: 20, b: 30, c: 50 } });

      const layout = getRoot().getLayout();
      layout.a = 99;

      expect(getRoot().getLayout()).toEqual({ a: 20, b: 30, c: 50 });
      await drag('handle-a', 100);
      expect(getRoot().getLayout()).toEqual({ a: 30, b: 20, c: 50 });
    });

    it('sets the layout with a change, an update and a commit, in that order', async () => {
      const calls: string[] = [];
      const reasons: string[] = [];
      const getRoot = await renderRoot({
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
      });

      getRoot().setLayout({ a: 10, b: 20, c: 70 });
      await nextTick();

      expect(calls).toEqual(['layoutChange', 'update:layout', 'layoutCommitted']);
      expect(reasons).toEqual([REASONS.imperativeAction, REASONS.imperativeAction]);
      expect(grows('a', 'b', 'c')).toEqual(['10', '20', '70']);
    });

    it('keeps the layout, and emits no update and no commit, when a listener cancels setLayout()', async () => {
      const onUpdate = vi.fn();
      const onCommitted = vi.fn();
      const getRoot = await renderRoot({
        onLayoutChange: (_layout: unknown, details: { cancel: () => void }) => {
          details.cancel();
        },
        'onUpdate:layout': onUpdate,
        onLayoutCommitted: onCommitted,
      });

      getRoot().setLayout({ a: 10, b: 20, c: 70 });
      await nextTick();

      expect(onUpdate).not.toHaveBeenCalled();
      expect(onCommitted).not.toHaveBeenCalled();
      expect(grows('a', 'b', 'c')).toEqual(['33.334', '33.333', '33.333']);
    });

    it('emits nothing when the panels show the layout already', async () => {
      const handlers = {
        onLayoutChange: vi.fn(),
        'onUpdate:layout': vi.fn(),
        onLayoutCommitted: vi.fn(),
      };
      const getRoot = await renderRoot({ defaultLayout: { a: 20, b: 30, c: 50 }, ...handlers });

      getRoot().setLayout({ a: 20, b: 30, c: 50 });
      getRoot().setLayout({ a: 2, b: 3, c: 5 });
      getRoot().reset();
      await nextTick();

      for (const handler of Object.values(handlers)) {
        expect(handler).not.toHaveBeenCalled();
      }
    });

    it('keeps the entry of a panel that is not mounted when it sets the layout', async () => {
      const onLayoutChange = vi.fn();
      const getRoot = await renderRoot({ onLayoutChange });

      getRoot().setLayout({ a: 30, b: 30, c: 20, gone: 20 });
      await nextTick();

      expect(onLayoutChange.mock.calls[0]?.[0]).toEqual({ a: 30, b: 30, c: 20, gone: 20 });
      expect(grows('a', 'b', 'c')).toEqual(['37.5', '37.5', '25']);
    });

    it('reads setLayout(null) as a layout with no entries', async () => {
      const getRoot = await renderRoot({ defaultLayout: { a: 20, b: 30, c: 50 } });
      expect(grows('a', 'b', 'c')).toEqual(['20', '30', '50']);

      getRoot().setLayout(null);
      await nextTick();

      expect(grows('a', 'b', 'c')).toEqual(['33.334', '33.333', '33.333']);
    });

    it('sets the layout of a disabled root', async () => {
      const getRoot = await renderRoot({ disabled: true });

      getRoot().setLayout({ a: 10, b: 20, c: 70 });
      await nextTick();

      expect(grows('a', 'b', 'c')).toEqual(['10', '20', '70']);
    });

    it.each([
      {
        name: 'the defaultLayout',
        root: { defaultLayout: { a: 20, b: 30, c: 50 } },
        expected: ['20', '30', '50'],
      },
      { name: 'the sizes of the panels', root: {}, expected: ['33.334', '33.333', '33.333'] },
    ])('gives the layout at the start with reset(), from $name', async ({ root, expected }) => {
      const onLayoutChange = vi.fn();
      const onLayoutCommitted = vi.fn();
      const getRoot = await renderRoot({ ...root, onLayoutChange, onLayoutCommitted });
      await drag('handle-a', 100);
      expect(grows('a', 'b', 'c')).not.toEqual(expected);
      onLayoutChange.mockClear();
      onLayoutCommitted.mockClear();

      getRoot().reset();
      await nextTick();

      expect(grows('a', 'b', 'c')).toEqual(expected);
      expect(onLayoutChange.mock.calls[0]?.[1].reason).toBe(REASONS.imperativeAction);
      expect(onLayoutCommitted.mock.calls[0]?.[1].reason).toBe(REASONS.imperativeAction);
    });

    it('gives the layout at the start with reset() when the app controls the layout', async () => {
      const layout = shallowRef<Record<string, number>>({ a: 50, b: 25, c: 25 });
      const instance: { current?: InstanceType<typeof Resizable.Root> } = {};
      await render(() => (
        <Three
          root={{
            layout: layout.value,
            ref: (value: unknown) => {
              instance.current = value as InstanceType<typeof Resizable.Root>;
            },
            'onUpdate:layout': (next: Record<string, number>) => {
              layout.value = next;
            },
          }}
        />
      ));

      instance.current?.reset();
      await nextTick();

      expect(grows('a', 'b', 'c')).toEqual(['33.334', '33.333', '33.333']);
    });
  });

  describe('useParentRoot()', () => {
    const Probe = defineComponent({
      props: { name: { type: String, required: true } },
      setup(props) {
        const parent = Resizable.useParentRoot();
        return () => (
          <button
            type="button"
            data-testid={props.name}
            data-layout={parent ? JSON.stringify(parent.getLayout()) : 'none'}
            onClick={() => {
              parent?.setLayout({ a: 10, b: 90 });
            }}
          >
            {parent ? parent.orientation.value : 'none'}
          </button>
        );
      },
    });

    it('gives the orientation and the methods of the root that the part is in', async () => {
      await render(
        <div style={{ width: '1000px' }}>
          <Resizable.Root orientation="vertical" style={{ height: '200px' }}>
            <Resizable.Panel id="a" data-testid="a">
              <Probe name="probe" />
            </Resizable.Panel>
            <Resizable.Handle />
            <Resizable.Panel id="b" data-testid="b" />
          </Resizable.Root>
        </div>,
      );
      const probe = screen.getByTestId('probe');
      expect(probe).toHaveTextContent('vertical');
      expect(JSON.parse(probe.dataset.layout ?? '')).toEqual({ a: 50, b: 50 });

      await fireEvent.click(probe);

      expect(grows('a', 'b')).toEqual(['10', '90']);
    });

    it('gives the root that is nearest to the part when roots are nested', async () => {
      await render(
        <div style={{ width: '1000px', height: '400px' }}>
          <Resizable.Root style={{ height: '100%' }}>
            <Resizable.Panel id="outer-a">
              <Probe name="outer-probe" />
            </Resizable.Panel>
            <Resizable.Handle />
            <Resizable.Panel id="outer-b">
              <Resizable.Root orientation="vertical" style={{ height: '100%' }}>
                <Resizable.Panel id="inner-a" defaultSize={30}>
                  <Probe name="inner-probe" />
                </Resizable.Panel>
                <Resizable.Handle />
                <Resizable.Panel id="inner-b" />
              </Resizable.Root>
            </Resizable.Panel>
          </Resizable.Root>
        </div>,
      );

      expect(screen.getByTestId('outer-probe')).toHaveTextContent('horizontal');
      expect(JSON.parse(screen.getByTestId('outer-probe').dataset.layout ?? '')).toEqual({
        'outer-a': 50,
        'outer-b': 50,
      });
      expect(screen.getByTestId('inner-probe')).toHaveTextContent('vertical');
      expect(JSON.parse(screen.getByTestId('inner-probe').dataset.layout ?? '')).toEqual({
        'inner-a': 30,
        'inner-b': 70,
      });
    });

    it('gives null outside a root', async () => {
      await render(<Probe name="probe" />);

      expect(screen.getByTestId('probe')).toHaveTextContent('none');
      expect(screen.getByTestId('probe')).toHaveAttribute('data-layout', 'none');
    });
  });

  describe('sizes with a unit', () => {
    it('gives the parent its measured layout at mount without ResizeObserver', async () => {
      vi.stubGlobal('ResizeObserver', undefined);
      onTestFinished(() => {
        vi.unstubAllGlobals();
      });
      const snapshot = vi.fn();
      const Parent = defineComponent(() => {
        const root = shallowRef<InstanceType<typeof Resizable.Root> | null>(null);
        onMounted(() => snapshot(root.value?.getLayout()));
        return () => (
          <Resizable.Root ref={root} style={{ width: '400px' }}>
            <Resizable.Panel id="a" defaultSize="100px" />
            <Resizable.Panel id="b" />
          </Resizable.Root>
        );
      });

      await render(<Parent />);

      expect(snapshot).toHaveBeenCalledExactlyOnceWith({ a: 25, b: 75 });
    });

    const widthOf = (id: string) => screen.getByTestId(id).getBoundingClientRect().width;

    // The container is 1000 px wide, and a handle has no size. A test can change the width.
    function Sized(props: {
      width?: ShallowRef<number>;
      root?: Record<string, unknown>;
      panels?: Record<string, unknown>[];
    }) {
      const panels = props.panels ?? [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
      return (
        <div style={{ width: `${props.width?.value ?? 1000}px` }}>
          <Resizable.Root data-testid="root" {...props.root}>
            {() =>
              panels.flatMap((panel, index) => [
                index > 0 ? (
                  <Resizable.Handle key={`handle-${index}`} data-testid={`handle-${index}`} />
                ) : null,
                <Resizable.Panel
                  key={`panel-${index}`}
                  data-testid={panel.id as string}
                  {...panel}
                />,
              ])
            }
          </Resizable.Root>
        </div>
      );
    }

    // The observer of the root reads the new width in the next frame, and the panels have their sizes
    // for it after the second frame. Until then they have the sizes of the old width.
    async function changeWidth(width: ShallowRef<number>, next: number) {
      await flushMicrotasks();
      width.value = next;
      await nextTick();
      await waitSingleFrame();
      await waitSingleFrame();
    }

    describe('prop: defaultLayout', () => {
      it('shows a size in pixels after the mount, and the others share the rest', async () => {
        await render(<Sized root={{ defaultLayout: { a: '240px' } }} />);

        expect(widthOf('a')).toBeCloseTo(240, 0);
        expect(widthOf('b')).toBeCloseTo(380, 0);
        expect(widthOf('c')).toBeCloseTo(380, 0);
        expect(grows('a', 'b', 'c')).toEqual(['24', '38', '38']);
      });

      it.each([
        { name: 'rem', size: '15rem' },
        { name: 'em', size: '15em' },
      ])('shows a size in $name after the mount', async ({ size }) => {
        const fontSize = Number.parseFloat(
          getComputedStyle(size.endsWith('rem') ? document.documentElement : document.body)
            .fontSize,
        );
        await render(
          <Sized
            root={{ defaultLayout: { a: size } }}
            panels={[{ id: 'a', style: { fontSize: `${fontSize}px` } }, { id: 'b' }]}
          />,
        );

        expect(widthOf('a')).toBeCloseTo(15 * fontSize, 0);
      });

      it('gives the size of the layout the pixels of a fixed panel', async () => {
        const width = shallowRef(1000);
        await render(
          <Sized
            width={width}
            root={{ defaultLayout: { a: '240px' } }}
            panels={[{ id: 'a', rootResizeBehavior: 'fixed' }, { id: 'b' }]}
          />,
        );
        expect(widthOf('a')).toBeCloseTo(240, 0);

        await changeWidth(width, 2000);

        await waitFor(() => {
          expect(widthOf('b')).toBeCloseTo(1760, 0);
        });
        expect(widthOf('a')).toBeCloseTo(240, 0);
      });

      it('gives a fixed panel the exact pixels of the size in the layout', async () => {
        // A percent has three decimals, and at 100,000 px one thousandth of a percent is 1 px. The
        // percent of 300.4 px is then 300 px, and the pixels of the layout are the pixels of the panel.
        const width = shallowRef(100_000);
        await render(
          <Sized
            width={width}
            root={{ defaultLayout: { a: '300.4px' } }}
            panels={[{ id: 'a', rootResizeBehavior: 'fixed' }, { id: 'b' }]}
          />,
        );

        await changeWidth(width, 50_000);

        await waitFor(() => {
          expect(widthOf('b')).toBeCloseTo(50_000 - 300.4, -1);
        });
        expect(Math.abs(widthOf('a') - 300.4)).toBeLessThan(0.2);
      });

      it('keeps the percent of a panel that is not fixed when the root changes size', async () => {
        const width = shallowRef(1000);
        await render(<Sized width={width} root={{ defaultLayout: { a: '240px' } }} />);

        await changeWidth(width, 2000);

        await waitFor(() => {
          expect(widthOf('a')).toBeCloseTo(480, 0);
        });
      });

      it('emits no layout event for the first measurement', async () => {
        const handlers = {
          onLayoutChange: vi.fn(),
          'onUpdate:layout': vi.fn(),
          onLayoutCommitted: vi.fn(),
        };
        await render(<Sized root={{ defaultLayout: { a: '240px' }, ...handlers }} />);

        expect(widthOf('a')).toBeCloseTo(240, 0);
        for (const handler of Object.values(handlers)) {
          expect(handler).not.toHaveBeenCalled();
        }
      });
    });

    describe('prop: layout', () => {
      it('shows a size in pixels, and gives percent in the events', async () => {
        const layout = shallowRef<Record<string, number | string>>({ a: '300px', b: 30, c: 40 });
        const onLayoutChange = vi.fn();
        await render(() => <Sized root={{ layout: layout.value, onLayoutChange }} />);
        expect(widthOf('a')).toBeCloseTo(300, 0);

        await drag('handle-1', 100);

        expect(onLayoutChange.mock.calls[0]?.[0]).toEqual({ a: 40, b: 20, c: 40 });
      });

      it('gives the first sizes of the panels when the layout of the app is empty', async () => {
        const layout = shallowRef<Record<string, number | string>>({ a: 60, b: 20, c: 20 });
        await render(() => (
          <Sized
            root={{ layout: layout.value }}
            panels={[{ id: 'a', defaultSize: '200px' }, { id: 'b' }, { id: 'c' }]}
          />
        ));
        expect(grows('a', 'b', 'c')).toEqual(['60', '20', '20']);

        layout.value = {};
        await nextTick();

        expect(widthOf('a')).toBeCloseTo(200, 0);
        expect(widthOf('b')).toBeCloseTo(400, 0);
      });

      it('gives a fixed panel the pixels of the first layout when the layout is empty again', async () => {
        const width = shallowRef(1000);
        const layout = shallowRef<Record<string, number | string>>({ a: 60, b: 40 });
        await render(() => (
          <Sized
            width={width}
            root={{ layout: layout.value }}
            panels={[{ id: 'a', defaultSize: 20, rootResizeBehavior: 'fixed' }, { id: 'b' }]}
          />
        ));

        layout.value = {};
        await nextTick();
        expect(widthOf('a')).toBeCloseTo(200, 0);
        await changeWidth(width, 2000);

        await waitFor(() => {
          expect(widthOf('b')).toBeCloseTo(1800, 0);
        });
        expect(widthOf('a')).toBeCloseTo(200, 0);
      });

      it('scales a panel that mounts later with a length when the app does not write the layout', async () => {
        const width = shallowRef(1000);
        const panels = shallowRef<Record<string, unknown>[]>([{ id: 'a' }, { id: 'b' }]);
        await render(() => (
          <Sized width={width} root={{ layout: { a: 50, b: 50 } }} panels={panels.value} />
        ));

        panels.value = [...panels.value, { id: 'late', defaultSize: '200px' }];
        await nextTick();
        await waitFor(() => {
          expect(widthOf('late')).toBeCloseTo(200, 0);
        });
        await changeWidth(width, 2000);

        // The panel keeps the percent that its length gave, as a panel of the first render does.
        await waitFor(() => {
          expect(widthOf('a')).toBeCloseTo(800, 0);
        });
        expect(widthOf('late')).toBeCloseTo(400, 0);
      });
    });

    describe('details.snapshot', () => {
      const fixed = [{ id: 'nav', defaultSize: 20, rootResizeBehavior: 'fixed' }, { id: 'main' }];

      it('has the pixels of a fixed panel and the percent of the others after a drag', async () => {
        const onLayoutCommitted = vi.fn();
        await render(<Sized root={{ onLayoutCommitted }} panels={fixed} />);

        await drag('handle-1', 100);

        expect(onLayoutCommitted.mock.calls[0]?.[0]).toEqual({ nav: 30, main: 70 });
        expect(onLayoutCommitted.mock.calls[0]?.[1].snapshot).toEqual({ nav: '300px', main: 70 });
      });

      it.each([
        {
          name: 'a key',
          reason: REASONS.keyboard,
          expected: { nav: '310px', main: 69 },
          act: async ({ user }: { user: { keyboard: (keys: string) => Promise<void> } }) => {
            await user.keyboard('{ArrowRight}');
          },
        },
        {
          name: 'a method',
          reason: REASONS.imperativeAction,
          expected: { nav: '350px', main: 65 },
          act: ({ root }: { root: InstanceType<typeof Resizable.Root> | undefined }) => {
            root?.setLayout({ nav: '350px', main: 65 });
          },
        },
        {
          name: 'a double click',
          reason: 'reset',
          expected: { nav: '300px', main: 70 },
          act: async ({ handle }: { handle: HTMLElement }) => {
            await fireEvent.dblClick(handle);
          },
        },
      ])('has the snapshot for $name', async ({ reason, expected, act }) => {
        const onLayoutCommitted = vi.fn();
        const instance: { current?: InstanceType<typeof Resizable.Root> } = {};
        const { user } = await render(() => (
          <Sized
            root={{
              onLayoutCommitted,
              defaultLayout: { nav: 30, main: 70 },
              ref: (value: unknown) => {
                instance.current = value as InstanceType<typeof Resizable.Root>;
              },
            }}
            panels={fixed}
          />
        ));
        const handle = screen.getByTestId('handle-1');
        handle.focus();
        if (reason === 'reset') {
          // The double click gives the first size back, so the panel must have another size.
          await user.keyboard('{ArrowRight}');
          onLayoutCommitted.mockClear();
        }

        await act({ user, root: instance.current, handle });

        expect(onLayoutCommitted).toHaveBeenCalledTimes(1);
        expect(onLayoutCommitted.mock.calls[0]?.[1].reason).toBe(reason);
        expect(onLayoutCommitted.mock.calls[0]?.[1].snapshot).toEqual(expected);
      });

      it('has the pixels of the layout of the event when the app has not written the layout', async () => {
        const onLayoutCommitted = vi.fn();
        const { user } = await render(() => (
          <Sized
            root={{
              layout: { nav: 20, main: 80 },
              onLayoutCommitted,
              // The app writes nothing, so the pixels of the panel stay what the layout says.
            }}
            panels={fixed}
          />
        ));
        screen.getByTestId('handle-1').focus();

        await user.keyboard('{ArrowRight}');
        await user.keyboard('{ArrowRight}');

        expect(onLayoutCommitted.mock.calls.map(([, details]) => details.snapshot)).toEqual([
          { nav: '210px', main: 79 },
          { nav: '210px', main: 79 },
        ]);
      });

      it('has the percent of each panel with no fixed panel', async () => {
        const onLayoutCommitted = vi.fn();
        await render(
          <Sized
            root={{ onLayoutCommitted }}
            panels={[{ id: 'a' }, { id: 'b', defaultSize: 40 }]}
          />,
        );

        await drag('handle-1', 100);

        expect(onLayoutCommitted.mock.calls[0]?.[1].snapshot).toEqual({ a: 70, b: 30 });
      });

      it('gives back each fixed panel its pixels when the snapshot is the layout', async () => {
        const onLayoutCommitted = vi.fn();
        const first = await render(<Sized root={{ onLayoutCommitted }} panels={fixed} />);
        await drag('handle-1', 100);
        const snapshot = onLayoutCommitted.mock.calls[0]?.[1].snapshot as Record<
          string,
          string | number
        >;
        expect(snapshot).toEqual({ nav: '300px', main: 70 });
        first.unmount();

        await render(
          <Sized width={shallowRef(2000)} root={{ defaultLayout: snapshot }} panels={fixed} />,
        );

        // A layout in percent would give the panel 600 px.
        expect(widthOf('nav')).toBeCloseTo(300, 0);
      });
    });

    describe('a panel id that an object also has', () => {
      it.each([
        { id: 'constructor', defaultSize: '240px' },
        { id: 'toString', defaultSize: '240px' },
        { id: '__proto__', defaultSize: '240px' },
        { id: 'constructor', defaultSize: 24 },
        { id: '__proto__', defaultSize: 24 },
      ])(
        'gives the panel $id with the size $defaultSize its pixels as a fixed panel',
        async ({ id, defaultSize }) => {
          const width = shallowRef(1000);
          await render(() => (
            <div style={{ width: `${width.value}px` }}>
              <Resizable.Root>
                <Resizable.Panel
                  id={id}
                  data-testid="a"
                  defaultSize={defaultSize}
                  rootResizeBehavior="fixed"
                />
                <Resizable.Handle data-testid="handle" />
                <Resizable.Panel id="b" data-testid="b" />
              </Resizable.Root>
            </div>
          ));
          await waitFor(() => {
            expect(screen.getByTestId('handle')).toHaveAttribute('aria-valuenow', '24');
          });
          expect(widthOf('a')).toBeCloseTo(240, 0);

          await changeWidth(width, 2000);

          await waitFor(() => {
            expect(widthOf('b')).toBeCloseTo(1760, 0);
          });
          expect(widthOf('a')).toBeCloseTo(240, 0);
        },
      );
    });

    describe('prop: dragStep', () => {
      const start = { a: 50, b: 30, c: 20 };

      it.each([
        { name: 'a number of percent', dragStep: 5, distance: 72, expected: ['55', '25', '20'] },
        { name: 'a percent string', dragStep: '5%', distance: 72, expected: ['55', '25', '20'] },
        { name: 'pixels, up', dragStep: '100px', distance: 72, expected: ['60', '20', '20'] },
        { name: 'pixels, down', dragStep: '100px', distance: -72, expected: ['40', '40', '20'] },
        {
          name: 'pixels, below half a step',
          dragStep: '100px',
          distance: 40,
          expected: ['50', '30', '20'],
        },
      ])('moves a drag in steps of $name', async ({ dragStep, distance, expected }) => {
        await render(<Sized root={{ defaultLayout: start, dragStep }} />);

        await drag('handle-1', distance);

        expect(grows('a', 'b', 'c')).toEqual(expected);
      });

      it('does not step a key', async () => {
        const { user } = await render(<Sized root={{ defaultLayout: start, dragStep: 5 }} />);
        screen.getByTestId('handle-1').focus();

        await user.keyboard('{ArrowRight}');

        expect(grows('a', 'b', 'c')).toEqual(['51', '29', '20']);
      });
    });

    describe('a handle that changes size', () => {
      it('changes the panel space, so a length has another percent', async () => {
        const handleWidth = shallowRef(0);
        await render(() => (
          <div style={{ width: '1000px' }}>
            <Resizable.Root>
              <Resizable.Panel id="a" data-testid="a" minSize="300px" defaultSize={10} />
              <Resizable.Handle style={{ width: `${handleWidth.value}px` }} />
              <Resizable.Panel id="b" data-testid="b" />
            </Resizable.Root>
          </div>
        ));
        expect(widthOf('a')).toBeCloseTo(300, 0);
        // The observer reads the page once after the mount. The handle must change size after that
        // read, so that only the observer of the handle gives the new panel space.
        await waitSingleFrame();
        await waitSingleFrame();

        handleWidth.value = 100;
        await nextTick();
        // The observer reads the page in a frame. WebKit can hold that frame for a second when the
        // case requests no frame.
        await waitSingleFrame();
        await waitSingleFrame();

        // The panels share 900 px, and 300 px is a third of them.
        await waitFor(() => {
          expect(widthOf('b')).toBeCloseTo(600, 0);
        });
        expect(widthOf('a')).toBeCloseTo(300, 0);
      });
    });

    describe('props: step and largeStep', () => {
      it('moves a key by a step in pixels', async () => {
        const { user } = await render(
          <Sized
            root={{ defaultLayout: { a: 50, b: 30, c: 20 }, step: '16px', largeStep: '100px' }}
          />,
        );
        screen.getByTestId('handle-1').focus();

        await user.keyboard('{ArrowRight}');
        expect(grows('a', 'b', 'c')).toEqual(['51.6', '28.4', '20']);

        await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
        expect(grows('a', 'b', 'c')).toEqual(['61.6', '18.4', '20']);

        await user.keyboard('{PageUp}');
        expect(grows('a', 'b', 'c')).toEqual(['71.6', '8.4', '20']);
      });

      it('moves a key by a step in em, which is the font size of the root', async () => {
        const { user } = await render(
          <Sized
            root={{
              defaultLayout: { a: 50, b: 30, c: 20 },
              step: '2em',
              style: { fontSize: '20px' },
            }}
          />,
        );
        screen.getByTestId('handle-1').focus();

        await user.keyboard('{ArrowRight}');

        // 2em is 40 px, which is 4% of the panel space.
        expect(grows('a', 'b', 'c')).toEqual(['54', '26', '20']);
      });

      it('moves a key by a step in rem', async () => {
        const { user } = await render(
          <Sized root={{ defaultLayout: { a: 50, b: 30, c: 20 }, step: '5rem' }} />,
        );
        screen.getByTestId('handle-1').focus();

        await user.keyboard('{ArrowRight}');

        const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
        expect(Number(screen.getByTestId('a').style.flexGrow)).toBeCloseTo(50 + (5 * rem) / 10, 3);
      });
    });

    describe('a root that is hidden', () => {
      it('shows its sizes and takes its pixels when it shows, and keeps them when it hides again', async () => {
        const visible = shallowRef(false);
        const width = shallowRef(1000);
        const onResize = vi.fn();
        await render(() => (
          <div style={{ display: visible.value ? 'block' : 'none', width: `${width.value}px` }}>
            <Resizable.Root>
              <Resizable.Panel
                id="nav"
                data-testid="nav"
                defaultSize="200px"
                rootResizeBehavior="fixed"
                onResize={onResize}
              />
              <Resizable.Handle data-testid="handle" />
              <Resizable.Panel id="main" data-testid="main" />
            </Resizable.Root>
          </div>
        ));
        // A root with no room has the length that the panel asked for, and has no value.
        expect(screen.getByTestId('nav').style.flex).toBe('0 1 200px');
        expect(screen.getByTestId('handle')).not.toHaveAttribute('aria-valuenow');
        expect(onResize).not.toHaveBeenCalled();

        // A change of the layout after a `waitFor` can fall in the checkpoint of an observer. So each
        // change waits for the microtasks first.
        await flushMicrotasks();
        visible.value = true;
        await nextTick();
        // The observer reads the page in a frame. WebKit can hold that frame for a second when the
        // case requests no frame.
        await waitSingleFrame();
        await waitSingleFrame();
        await waitFor(() => {
          expect(screen.getByTestId('handle')).toHaveAttribute('aria-valuenow', '20');
        });
        expect(widthOf('nav')).toBeCloseTo(200, 0);
        expect(onResize).toHaveBeenCalledTimes(1);

        // The pixels hold while the root is hidden.
        await flushMicrotasks();
        visible.value = false;
        await nextTick();
        await flushMicrotasks();
        width.value = 1500;
        await nextTick();
        await flushMicrotasks();
        visible.value = true;
        await nextTick();
        await waitSingleFrame();
        await waitSingleFrame();

        await waitFor(() => {
          expect(widthOf('main')).toBeCloseTo(1300, 0);
        });
        expect(widthOf('nav')).toBeCloseTo(200, 0);
        expect(screen.getByTestId('handle')).toHaveAttribute('aria-valuenow', '13');
      });

      it('gives no layout event for a panel with a length that mounts while the root has no room', async () => {
        const show = shallowRef(false);
        const onLayoutChange = vi.fn();
        await render(() => (
          <div style={{ display: 'none', width: '1000px' }}>
            <Resizable.Root onLayoutChange={onLayoutChange}>
              <Resizable.Panel id="a" />
              <Resizable.Handle />
              <Resizable.Panel id="b" />
              {show.value ? (
                <>
                  <Resizable.Handle />
                  <Resizable.Panel id="late" data-testid="late" defaultSize="200px" />
                </>
              ) : null}
            </Resizable.Root>
          </div>
        ));

        show.value = true;
        await nextTick();
        await flushMicrotasks();

        expect(screen.getByTestId('late').style.flex).toBe('0 1 200px');
        expect(onLayoutChange).not.toHaveBeenCalled();
      });

      it('starts no drag and does nothing for a key or a method while the root has no room', async () => {
        const instance: { current?: InstanceType<typeof Resizable.Root> } = {};
        const onLayoutChange = vi.fn();
        await render(() => (
          <div style={{ display: 'none', width: '1000px' }}>
            <Resizable.Root
              onLayoutChange={onLayoutChange}
              ref={(value: unknown) => {
                instance.current = value as InstanceType<typeof Resizable.Root>;
              }}
            >
              <Resizable.Panel id="nav" data-testid="nav" defaultSize="200px" />
              <Resizable.Handle data-testid="handle" />
              <Resizable.Panel id="main" data-testid="main" />
            </Resizable.Root>
          </div>
        ));

        await drag('handle', 100);
        await fireEvent.keyDown(screen.getByTestId('handle'), { key: 'ArrowRight' });
        instance.current?.setLayout({ nav: 40, main: 60 });
        instance.current?.reset();
        await nextTick();

        expect(onLayoutChange).not.toHaveBeenCalled();
        expect(screen.getByTestId('nav').style.flex).toBe('0 1 200px');
        expect(instance.current?.getLayout()).toEqual({ nav: 0, main: 100 });
      });
    });

    describe('a root that a scale changes', () => {
      it.each([
        { name: 'a scale transform', scale: { transform: 'scale(0.5)', transformOrigin: '0 0' } },
        { name: 'a CSS zoom', scale: { zoom: 0.5 } },
      ])(
        'has sizes in layout pixels, and a drag that follows the pointer, with $name',
        async ({ scale }) => {
          const onResize = vi.fn();
          const instance: { current?: InstanceType<typeof Resizable.Panel> } = {};
          await render(() => (
            <div style={{ width: '1000px', ...scale }}>
              <Resizable.Root>
                <Resizable.Panel
                  id="a"
                  data-testid="a"
                  minSize="200px"
                  defaultSize={50}
                  onResize={onResize}
                  ref={(value: unknown) => {
                    instance.current = value as InstanceType<typeof Resizable.Panel>;
                  }}
                />
                <Resizable.Handle data-testid="handle" />
                <Resizable.Panel id="b" data-testid="b" />
              </Resizable.Root>
            </div>
          ));
          await waitFor(() => {
            expect(onResize).toHaveBeenCalledTimes(1);
          });
          // The panel has 500 layout pixels, which are 250 pixels on the screen.
          expect(widthOf('a')).toBeCloseTo(250, 0);
          expect(onResize.mock.calls[0]?.[0]).toEqual({ percent: 50, pixels: 500 });

          await drag('handle', 50);
          expect(widthOf('a')).toBeCloseTo(300, 0);

          // A minimum of 200 px is 100 px on the screen.
          await drag('handle', -1000);
          expect(widthOf('a')).toBeCloseTo(100, 0);
          expect(instance.current?.getSize()).toEqual({ percent: 20, pixels: 200 });
        },
      );
    });

    describe('methods', () => {
      type RootInstance = InstanceType<typeof Resizable.Root>;

      async function renderMethods(options: {
        root?: Record<string, unknown>;
        panels?: Record<string, unknown>[];
      }) {
        const instance: { current?: RootInstance } = {};
        const width = shallowRef(1000);
        await render(() => (
          <Sized
            width={width}
            root={{
              ref: (value: unknown) => {
                instance.current = value as RootInstance;
              },
              ...options.root,
            }}
            panels={options.panels}
          />
        ));
        return { width, getRoot: () => instance.current as RootInstance };
      }

      it('sets a layout with sizes in pixels', async () => {
        const onLayoutChange = vi.fn();
        const { getRoot } = await renderMethods({ root: { onLayoutChange } });

        getRoot().setLayout({ a: '300px', b: 30, c: '40%' });
        await nextTick();

        expect(widthOf('a')).toBeCloseTo(300, 0);
        expect(onLayoutChange.mock.calls[0]?.[0]).toEqual({ a: 30, b: 30, c: 40 });
      });

      it('gives a fixed panel the pixels of the size that setLayout() gives', async () => {
        const { getRoot, width } = await renderMethods({
          panels: [{ id: 'a', rootResizeBehavior: 'fixed' }, { id: 'b' }],
        });

        getRoot().setLayout({ a: '300px', b: 70 });
        await nextTick();
        await changeWidth(width, 2000);

        await waitFor(() => {
          expect(widthOf('b')).toBeCloseTo(1700, 0);
        });
        expect(widthOf('a')).toBeCloseTo(300, 0);
      });

      it('gives back the pixels of the first layout with reset()', async () => {
        const { getRoot, width } = await renderMethods({
          root: { defaultLayout: { a: '240px' } },
          panels: [{ id: 'a', rootResizeBehavior: 'fixed' }, { id: 'b' }],
        });
        await drag('handle-1', 100);
        expect(widthOf('a')).toBeCloseTo(340, 0);
        await changeWidth(width, 2000);
        await waitFor(() => {
          expect(widthOf('b')).toBeCloseTo(1660, 0);
        });

        getRoot().reset();
        await nextTick();

        expect(widthOf('a')).toBeCloseTo(240, 0);
      });

      it('gives back the pixels of the first layout with a double click', async () => {
        await renderMethods({
          root: { defaultLayout: { a: '240px' } },
          panels: [{ id: 'a', rootResizeBehavior: 'fixed' }, { id: 'b' }],
        });
        await drag('handle-1', 100);

        await fireEvent.dblClick(screen.getByTestId('handle-1'));

        expect(widthOf('a')).toBeCloseTo(240, 0);
      });

      it('gives back a first size in pixels at the width that the root has, with reset()', async () => {
        const { getRoot, width } = await renderMethods({
          root: { defaultLayout: { a: '240px' } },
        });
        await changeWidth(width, 2000);
        await waitFor(() => {
          expect(widthOf('a')).toBeCloseTo(480, 0);
        });

        getRoot().reset();
        await nextTick();

        // The length of the first layout is 240 px of the present panel space.
        expect(widthOf('a')).toBeCloseTo(240, 0);
      });
    });
  });

  describe('prop: resizeMode', () => {
    const onRelease = { resizeMode: 'on-release' } as const;
    const handleA = () => screen.getByTestId('handle-a');
    const press = (clientX = 0) =>
      fireEvent.pointerDown(handleA(), { ...pointer, clientX, buttons: 1 });
    const moveTo = (clientX: number, buttons = 1) =>
      fireEvent.pointerMove(handleA(), { ...pointer, clientX, buttons });

    function trackEvents(calls: string[]) {
      return {
        onLayoutChange: (_layout: unknown, details: { reason: string }) => {
          calls.push(`layoutChange ${details.reason}`);
        },
        'onUpdate:layout': () => {
          calls.push('update:layout');
        },
        onLayoutCommitted: () => {
          calls.push('layoutCommitted');
        },
        onDraggingChange: (dragging: boolean) => {
          calls.push(`draggingChange ${String(dragging)}`);
        },
      };
    }

    it('keeps the layout, and emits no change, during the moves of a drag', async () => {
      const calls: string[] = [];
      await render(<Three root={{ ...onRelease, ...trackEvents(calls) }} />);
      const before = screen.getByTestId('a').getBoundingClientRect().width;

      await press();
      await moveTo(100);
      await moveTo(200);

      expect(calls).toEqual(['draggingChange true']);
      expect(screen.getByTestId('a').getBoundingClientRect().width).toBe(before);
      expect(grows('a', 'b', 'c')).toEqual(['33.334', '33.333', '33.333']);
    });

    it('writes the layout one time at the release, with the change, the update and the commit in that order', async () => {
      const calls: string[] = [];
      await render(<Three root={{ ...onRelease, ...trackEvents(calls) }} />);

      await press();
      await moveTo(100);
      await moveTo(200);
      await fireEvent.pointerUp(handleA(), { ...pointer, clientX: 200 });

      expect(calls).toEqual([
        'draggingChange true',
        'draggingChange false',
        'layoutChange drag',
        'update:layout',
        'layoutCommitted',
      ]);
      expect(grows('a', 'b', 'c')).toEqual(['53.334', '13.333', '33.333']);
    });

    it('gives the release event to the change and to the commit', async () => {
      const onLayoutChange = vi.fn();
      const onLayoutCommitted = vi.fn();
      await render(<Three root={{ ...onRelease, onLayoutChange, onLayoutCommitted }} />);

      await press();
      await moveTo(100);
      await fireEvent.pointerUp(handleA(), { ...pointer, clientX: 100 });

      expect(onLayoutChange.mock.calls[0]?.[1].event.type).toBe('pointerup');
      expect(onLayoutCommitted.mock.calls[0]?.[1].event.type).toBe('pointerup');
    });

    it('writes the layout of a move with no button down', async () => {
      const calls: string[] = [];
      await render(<Three root={{ ...onRelease, ...trackEvents(calls) }} />);

      await press();
      await moveTo(100);
      await moveTo(100, 0);

      expect(calls).toContain('layoutCommitted');
      expect(grows('a', 'b', 'c')).toEqual(['43.334', '23.333', '33.333']);
    });

    it.each([
      {
        name: 'pointercancel',
        end: () => fireEvent.pointerCancel(handleA(), pointer),
      },
      {
        name: 'lostpointercapture with no pointerup',
        end: () => fireEvent.lostPointerCapture(handleA(), pointer),
      },
    ])('writes nothing after $name', async ({ end }) => {
      const calls: string[] = [];
      await render(<Three root={{ ...onRelease, ...trackEvents(calls) }} />);

      await press();
      await moveTo(100);
      await end();

      expect(calls).toEqual(['draggingChange true', 'draggingChange false']);
      expect(grows('a', 'b', 'c')).toEqual(['33.334', '33.333', '33.333']);
    });

    it('writes nothing when the root becomes disabled during the drag', async () => {
      const disabled = shallowRef(false);
      const calls: string[] = [];
      await render(() => (
        <Three root={{ ...onRelease, ...trackEvents(calls), disabled: disabled.value }} />
      ));

      await press();
      await moveTo(100);
      disabled.value = true;
      await nextTick();
      await fireEvent.pointerUp(handleA(), { ...pointer, clientX: 100 });

      expect(calls).toEqual(['draggingChange true', 'draggingChange false']);
    });

    it('writes nothing when a panel mounts during the drag', async () => {
      const showLate = shallowRef(false);
      const calls: string[] = [];
      await render(() => (
        <div style={{ width: '1000px' }}>
          <Resizable.Root {...onRelease} {...trackEvents(calls)}>
            <Resizable.Panel id="a" />
            <Resizable.Handle data-testid="handle-a" />
            <Resizable.Panel id="b" />
            {showLate.value ? <Resizable.Panel id="late" /> : null}
          </Resizable.Root>
        </div>
      ));

      await press();
      showLate.value = true;
      await nextTick();
      calls.length = 0;
      await moveTo(100);
      await fireEvent.pointerUp(handleA(), { ...pointer, clientX: 100 });

      expect(calls).toEqual(['draggingChange false']);
    });

    it('emits no change for a release at the start point', async () => {
      const calls: string[] = [];
      await render(<Three root={{ ...onRelease, ...trackEvents(calls) }} />);

      await press();
      await moveTo(100);
      await moveTo(0);
      await fireEvent.pointerUp(handleA(), { ...pointer, clientX: 0 });

      expect(calls).toEqual(['draggingChange true', 'draggingChange false']);
    });

    it('keeps the layout and emits no commit when a listener cancels the change at the release', async () => {
      const onLayoutCommitted = vi.fn();
      const onUpdate = vi.fn();
      await render(
        <Three
          root={{
            ...onRelease,
            onLayoutChange: (_layout: unknown, details: { cancel: () => void }) => {
              details.cancel();
            },
            'onUpdate:layout': onUpdate,
            onLayoutCommitted,
          }}
        />,
      );

      await press();
      await moveTo(100);
      await fireEvent.pointerUp(handleA(), { ...pointer, clientX: 100 });

      expect(onUpdate).not.toHaveBeenCalled();
      expect(onLayoutCommitted).not.toHaveBeenCalled();
      expect(grows('a', 'b', 'c')).toEqual(['33.334', '33.333', '33.333']);
    });

    it('writes a key at once, when no drag runs', async () => {
      const calls: string[] = [];
      await render(<Three root={{ ...onRelease, ...trackEvents(calls) }} />);

      await fireEvent.keyDown(handleA(), { key: 'ArrowRight' });

      expect(calls).toEqual(['layoutChange keyboard', 'update:layout', 'layoutCommitted']);
    });

    it('collapses a panel at the release when the pending layout is past the threshold', async () => {
      await render(
        <div style={{ width: '1000px' }}>
          <Resizable.Root {...onRelease}>
            <Resizable.Panel id="a" data-testid="a" collapsible minSize={20} defaultSize={40} />
            <Resizable.Handle data-testid="handle-a" />
            <Resizable.Panel id="b" data-testid="b" />
          </Resizable.Root>
        </div>,
      );

      await press(400);
      await moveTo(0);
      expect(screen.getByTestId('a')).not.toHaveAttribute('data-collapsed');
      expect(handleA().style.getPropertyValue('--resizable-handle-preview-offset')).toBe('-400px');
      await fireEvent.pointerUp(handleA(), { ...pointer, clientX: 0 });

      expect(screen.getByTestId('a')).toHaveAttribute('data-collapsed');
    });

    it('snaps the pending layout as it snaps a live move', async () => {
      await render(
        <div style={{ width: '1000px' }}>
          <Resizable.Root {...onRelease} dragStep={10}>
            <Resizable.Panel id="a" />
            <Resizable.Handle data-testid="handle-a" />
            <Resizable.Panel id="b" />
          </Resizable.Root>
        </div>,
      );

      await press();
      await moveTo(137);

      expect(handleA().style.getPropertyValue('--resizable-handle-preview-offset')).toBe('100px');
    });

    it('shows the layout that the parent writes at the release in a controlled root', async () => {
      const layout = shallowRef<Record<string, number>>({ a: 30, b: 30, c: 40 });
      await render(() => (
        <Three
          root={{
            ...onRelease,
            layout: layout.value,
            'onUpdate:layout': (next: Record<string, number>) => {
              layout.value = next;
            },
          }}
        />
      ));

      await press();
      await moveTo(100);
      expect(grows('a', 'b', 'c')).toEqual(['30', '30', '40']);
      await fireEvent.pointerUp(handleA(), { ...pointer, clientX: 100 });

      expect(grows('a', 'b', 'c')).toEqual(['40', '20', '40']);
    });

    it('reads the mode at the start of each drag', async () => {
      const mode = shallowRef('live');
      const onLayoutChange = vi.fn();
      await render(() => <Three root={{ resizeMode: mode.value, onLayoutChange }} />);

      await press();
      mode.value = 'on-release';
      await nextTick();
      await moveTo(100);
      expect(onLayoutChange).toHaveBeenCalledTimes(1);
      await fireEvent.pointerUp(handleA(), { ...pointer, clientX: 100 });

      await press(100);
      await moveTo(200);
      expect(onLayoutChange).toHaveBeenCalledTimes(1);
      await fireEvent.pointerUp(handleA(), { ...pointer, clientX: 200 });
      expect(onLayoutChange).toHaveBeenCalledTimes(2);
    });
  });

  describe('prop: dragEdges', () => {
    const edgesOf = (root: HTMLElement) =>
      Array.from(root.querySelectorAll<HTMLElement>('[data-vase-ui-resizable-edge]'));
    const widthOf = (id: string) => screen.getByTestId(id).getBoundingClientRect().width;
    const heightOf = (id: string) => screen.getByTestId(id).getBoundingClientRect().height;

    // The root is 400 px wide and 100 px high, so 1% of the panel space is 4 px on the horizontal
    // axis and 1 px on the vertical axis.
    function renderEdges(
      root: Record<string, unknown> = {},
      content: unknown = [
        <Resizable.Panel key="a" id="a" data-testid="a" />,
        <Resizable.Panel key="b" id="b" data-testid="b" />,
      ],
    ) {
      return render(
        <div style={{ width: '400px', height: '100px' }}>
          <Resizable.Root data-testid="root" dragEdges style={{ height: '100%' }} {...root}>
            {content}
          </Resizable.Root>
        </div>,
      );
    }

    async function findEdges(count = 1) {
      const root = screen.getByTestId('root');
      await waitFor(() => {
        expect(edgesOf(root)).toHaveLength(count);
      });
      return edgesOf(root);
    }

    // The nodes come after a read of the page. A root that has none gets no node later.
    async function expectNoEdge() {
      await waitSingleFrame();
      await flushMicrotasks();
      expect(edgesOf(screen.getByTestId('root'))).toHaveLength(0);
    }

    const boxOf = (edge: HTMLElement) => ({
      left: edge.style.left,
      top: edge.style.top,
      width: edge.style.width,
      height: edge.style.height,
    });

    it('renders no node with no dragEdges', async () => {
      await renderEdges({ dragEdges: false });

      await expectNoEdge();
    });

    it('renders one node on the boundary of two panels, after the mount', async () => {
      await renderEdges();

      const [edge, ...others] = await findEdges();

      expect(others).toHaveLength(0);
      expect(edge?.parentElement).toBe(screen.getByTestId('root'));
      expect(edge?.tagName).toBe('SPAN');
      expect(edge).toBeEmptyDOMElement();
      expect(edge).not.toHaveAttribute('role');
      expect(edge).not.toHaveAttribute('tabindex');
      expect(screen.getByTestId('root').lastElementChild).toBe(edge);
    });

    it.each([
      {
        name: 'a horizontal root',
        root: {},
        box: { left: '195px', top: '0px', width: '10px', height: '100px' },
      },
      {
        name: 'a vertical root',
        root: { orientation: 'vertical' },
        box: { left: '0px', top: '45px', width: '400px', height: '10px' },
      },
    ])('has the box of the boundary in $name', async ({ root, box }) => {
      await renderEdges(root);

      const [edge] = await findEdges();

      expect(boxOf(edge as HTMLElement)).toEqual(box);
      expect(edge).toHaveAttribute('data-orientation', root.orientation ?? 'horizontal');
      expect(edge).toHaveStyle({ position: 'absolute', zIndex: '1', touchAction: 'none' });
    });

    it('gives position: relative to the root with dragEdges, and the style of the consumer wins', async () => {
      await renderEdges();
      expect(screen.getByTestId('root').style.position).toBe('relative');

      await renderEdges({ style: { position: 'static' } });

      expect(screen.getAllByTestId('root')[1]?.style.position).toBe('static');
    });

    it('gives no position to a root with no dragEdges', async () => {
      await renderEdges({ dragEdges: false });

      expect(screen.getByTestId('root').style.position).toBe('');
    });

    it.each([
      {
        name: 'a horizontal root',
        direction: 'ltr',
        orientation: 'horizontal',
        move: 40,
        size: widthOf,
        expected: 240,
      },
      {
        name: 'a vertical root',
        direction: 'ltr',
        orientation: 'vertical',
        move: 20,
        size: heightOf,
        expected: 70,
      },
      {
        name: 'a right-to-left root',
        direction: 'rtl',
        orientation: 'horizontal',
        move: 40,
        size: widthOf,
        expected: 160,
      },
    ] as const)(
      'moves the layout with a drag on the node in $name',
      async ({ direction, orientation, move, size, expected }) => {
        await render(
          <DirectionProvider direction={direction}>
            <div dir={direction} style={{ width: '400px', height: '100px' }}>
              <Resizable.Root
                data-testid="root"
                dragEdges
                orientation={orientation}
                style={{ height: '100%' }}
              >
                <Resizable.Panel id="a" data-testid="a" />
                <Resizable.Panel id="b" data-testid="b" />
              </Resizable.Root>
            </div>
          </DirectionProvider>,
        );
        const [edge] = await findEdges();
        const at = (distance: number) =>
          orientation === 'horizontal' ? { clientX: distance } : { clientY: distance };

        await fireEvent.pointerDown(edge as HTMLElement, { ...pointer, ...at(0), buttons: 1 });
        await fireEvent.pointerMove(edge as HTMLElement, { ...pointer, ...at(move), buttons: 1 });
        expect(size('a')).toBeCloseTo(expected, 0);
        await fireEvent.pointerUp(edge as HTMLElement, { ...pointer, ...at(move) });

        expect(size('a')).toBeCloseTo(expected, 0);
      },
    );

    it.each([
      { name: 'a touch', pointerType: 'touch' },
      { name: 'a pen', pointerType: 'pen' },
    ])('moves the layout with a drag of $name on the node', async ({ pointerType }) => {
      await renderEdges();
      const [edge] = await findEdges();

      await fireEvent.pointerDown(edge as HTMLElement, {
        ...pointer,
        pointerType,
        clientX: 0,
        buttons: 1,
      });
      await fireEvent.pointerMove(edge as HTMLElement, {
        ...pointer,
        pointerType,
        clientX: 40,
        buttons: 1,
      });

      expect(widthOf('a')).toBeCloseTo(240, 0);
    });

    it('renders one node for three panels with one handle', async () => {
      await renderEdges({ defaultLayout: { a: 25, b: 25, c: 50 } }, [
        <Resizable.Panel key="a" id="a" data-testid="a" />,
        <Resizable.Handle key="h" data-testid="handle" />,
        <Resizable.Panel key="b" id="b" data-testid="b" />,
        <Resizable.Panel key="c" id="c" data-testid="c" />,
      ]);

      const [edge, ...others] = await findEdges();

      expect(others).toHaveLength(0);
      // The boundary of the panels b and c is at 200 px.
      expect(edge?.style.left).toBe('195px');
    });

    it('removes the node when a handle mounts between the panels, and gives it back when the handle unmounts', async () => {
      const showHandle = shallowRef(false);
      await render(() => (
        <div style={{ width: '400px', height: '100px' }}>
          <Resizable.Root data-testid="root" dragEdges style={{ height: '100%' }}>
            <Resizable.Panel id="a" />
            {showHandle.value ? <Resizable.Handle /> : null}
            <Resizable.Panel id="b" />
          </Resizable.Root>
        </div>
      ));
      await findEdges();

      showHandle.value = true;
      await nextTick();
      await expectNoEdge();

      showHandle.value = false;
      await nextTick();
      await findEdges();
    });

    // Vitest makes this table one time for all runs of its cases, and a vnode is for one mount.
    it.each([
      {
        name: 'a disabled handle between the panels',
        content: () => [
          <Resizable.Panel key="a" id="a" />,
          <Resizable.Handle key="h" disabled />,
          <Resizable.Panel key="b" id="b" />,
        ],
      },
      {
        name: 'a disabled root',
        root: { disabled: true },
      },
      {
        name: 'each panel before the boundary disabled',
        content: () => [
          <Resizable.Panel key="a" id="a" disabled />,
          <Resizable.Panel key="b" id="b" />,
        ],
      },
      {
        name: 'each panel after the boundary disabled',
        content: () => [
          <Resizable.Panel key="a" id="a" />,
          <Resizable.Panel key="b" id="b" disabled />,
        ],
      },
    ])('renders no node for $name', async ({ root, content }) => {
      await renderEdges(root, content?.());

      await expectNoEdge();
    });

    it('renders no node for a size of 0 and no gap', async () => {
      await renderEdges({ hitAreaSize: 0 });

      await expectNoEdge();
    });

    it('renders a node of the width of the gap for a CSS gap of 16 px', async () => {
      await renderEdges({ style: { height: '100%', gap: '16px' } });

      const [edge, ...others] = await findEdges();

      expect(others).toHaveLength(0);
      expect(edge?.style.width).toBe('16px');
      expect(edge?.style.left).toBe(`${screen.getByTestId('a').offsetWidth}px`);
    });

    it('renders a node on each panel edge, and one drag, for an element of 180 px between the panels', async () => {
      await renderEdges({}, [
        <Resizable.Panel key="a" id="a" data-testid="a" />,
        <div key="x" data-testid="between" style={{ width: '180px', flex: 'none' }} />,
        <Resizable.Panel key="b" id="b" data-testid="b" />,
      ]);

      const [first, second, ...others] = await findEdges(2);

      expect(others).toHaveLength(0);
      expect(first?.style.width).toBe('10px');
      expect(second?.style.width).toBe('10px');
      expect(
        Number.parseFloat(second?.style.left ?? '0') - Number.parseFloat(first?.style.left ?? '0'),
      ).toBeGreaterThan(170);
      await fireEvent.pointerDown(first as HTMLElement, { ...pointer, clientX: 0, buttons: 1 });
      expect(first).toHaveAttribute('data-dragging');
      expect(second).toHaveAttribute('data-dragging');
    });

    it('moves the node with a drag', async () => {
      await renderEdges();
      const [edge] = await findEdges();
      expect(edge?.style.left).toBe('195px');

      await fireEvent.pointerDown(edge as HTMLElement, { ...pointer, clientX: 0, buttons: 1 });
      await fireEvent.pointerMove(edge as HTMLElement, { ...pointer, clientX: 40, buttons: 1 });

      await waitFor(() => {
        expect(edge?.style.left).toBe('235px');
      });
    });

    it('moves the node with a size change of the root', async () => {
      await renderEdges();
      const [edge] = await findEdges();
      expect(edge?.style.left).toBe('195px');
      await flushMicrotasks();

      (screen.getByTestId('root').parentElement as HTMLElement).style.width = '300px';

      await waitFor(() => {
        expect(edge?.style.left).toBe('145px');
      });
    });

    it('moves the node with a transition of the panels', async () => {
      const instance: { current?: InstanceType<typeof Resizable.Root> } = {};
      await render(() => (
        <div style={{ width: '400px', height: '100px' }}>
          <Resizable.Root
            data-testid="root"
            dragEdges
            style={{ height: '100%' }}
            ref={(value: unknown) => {
              instance.current = value as InstanceType<typeof Resizable.Root>;
            }}
          >
            <Resizable.Panel id="a" style={{ transition: 'flex-grow 100ms linear' }} />
            <Resizable.Panel id="b" />
          </Resizable.Root>
        </div>
      ));
      const [edge] = await findEdges();
      // The first layout has a transition too, so the boundary arrives in some frames.
      await waitFor(() => {
        expect(edge?.style.left).toBe('195px');
      });
      await flushMicrotasks();

      instance.current?.setLayout({ a: 25, b: 75 });

      await waitFor(() => {
        expect(edge?.style.left).toBe('95px');
      });
    });

    it('has the state of the boundary on the node', async () => {
      await renderEdges({}, [
        <Resizable.Panel key="a" id="a" data-testid="a" />,
        <Resizable.Panel key="b" id="b" data-testid="b" minSize={40} />,
      ]);
      const [edge] = await findEdges();
      expect(edge).toHaveAttribute('data-orientation', 'horizontal');
      expect(edge).not.toHaveAttribute('data-dragging');
      expect(edge).not.toHaveAttribute('data-at-min');
      expect(edge).not.toHaveAttribute('data-at-max');

      await fireEvent.pointerDown(edge as HTMLElement, { ...pointer, clientX: 0, buttons: 1 });
      expect(edge).toHaveAttribute('data-dragging');
      await fireEvent.pointerMove(edge as HTMLElement, { ...pointer, clientX: 300, buttons: 1 });
      expect(edge).toHaveAttribute('data-at-max');
      expect(edge).not.toHaveAttribute('data-at-min');
      await fireEvent.pointerMove(edge as HTMLElement, { ...pointer, clientX: -300, buttons: 1 });

      expect(edge).toHaveAttribute('data-at-min');
      expect(edge).not.toHaveAttribute('data-at-max');
    });

    it('has the preview distance on the node in the mode on-release', async () => {
      await renderEdges({ resizeMode: 'on-release' });
      const [edge] = await findEdges();

      await fireEvent.pointerDown(edge as HTMLElement, { ...pointer, clientX: 0, buttons: 1 });
      expect(edge?.style.getPropertyValue('--resizable-handle-preview-offset')).toBe('0px');
      await fireEvent.pointerMove(edge as HTMLElement, { ...pointer, clientX: 40, buttons: 1 });
      expect(edge?.style.getPropertyValue('--resizable-handle-preview-offset')).toBe('40px');
      expect(widthOf('a')).toBeCloseTo(200, 0);
      await fireEvent.pointerUp(edge as HTMLElement, { ...pointer, clientX: 40 });

      expect(edge?.style.getPropertyValue('--resizable-handle-preview-offset')).toBe('');
      expect(widthOf('a')).toBeCloseTo(240, 0);
    });

    it('does nothing for a double click and a key', async () => {
      const onLayoutChange = vi.fn();
      await renderEdges({ onLayoutChange });
      const [edge] = await findEdges();

      await fireEvent.dblClick(edge as HTMLElement);
      await fireEvent.keyDown(edge as HTMLElement, { key: 'ArrowRight' });
      await fireEvent.keyDown(edge as HTMLElement, { key: 'Enter' });

      expect(onLayoutChange).not.toHaveBeenCalled();
    });

    it('does not run a click listener of the root after a drag on the node, and runs it after a press with no move', async () => {
      const onClick = vi.fn();
      await renderEdges({ onClick });
      const [edge] = await findEdges();

      await fireEvent.pointerDown(edge as HTMLElement, { ...pointer, clientX: 0, buttons: 1 });
      await fireEvent.pointerMove(edge as HTMLElement, { ...pointer, clientX: 40, buttons: 1 });
      await fireEvent.pointerUp(edge as HTMLElement, { ...pointer, clientX: 40 });
      await fireEvent.click(edge as HTMLElement, { detail: 1 });
      expect(onClick).not.toHaveBeenCalled();

      await fireEvent.pointerDown(edge as HTMLElement, { ...pointer, clientX: 0, buttons: 1 });
      await fireEvent.pointerUp(edge as HTMLElement, { ...pointer, clientX: 0 });
      await fireEvent.click(edge as HTMLElement, { detail: 1 });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('prevents the default of the mousedown of a press on the node', async () => {
      await renderEdges();
      const [edge] = await findEdges();

      await fireEvent.pointerDown(edge as HTMLElement, { ...pointer, buttons: 1 });
      expect(await fireEvent.mouseDown(edge as HTMLElement)).toBe(false);
      await fireEvent.pointerUp(edge as HTMLElement, pointer);

      expect(await fireEvent.mouseDown(edge as HTMLElement)).toBe(true);
    });

    it('gets its node when a root that mounted with display: none shows', async () => {
      const hidden = shallowRef(true);
      await render(() => (
        <div style={{ width: '400px', height: '100px', display: hidden.value ? 'none' : 'block' }}>
          <Resizable.Root data-testid="root" dragEdges style={{ height: '100%' }}>
            <Resizable.Panel id="a" />
            <Resizable.Panel id="b" />
          </Resizable.Root>
        </div>
      ));
      await expectNoEdge();

      hidden.value = false;
      await nextTick();

      await findEdges();
    });

    it('ends a drag on the node when the root is deactivated', async () => {
      const onDraggingChange = vi.fn();
      const Layout = defineComponent({
        setup() {
          return () => (
            <div style={{ width: '400px', height: '100px' }}>
              <Resizable.Root
                data-testid="root"
                dragEdges
                style={{ height: '100%' }}
                onDraggingChange={onDraggingChange}
              >
                <Resizable.Panel id="a" />
                <Resizable.Panel id="b" />
              </Resizable.Root>
            </div>
          );
        },
      });
      const Other = defineComponent({ setup: () => () => <p>Other</p> });
      const active = shallowRef(true);
      await render(() => (
        <KeepAlive>{active.value ? <Layout key="layout" /> : <Other key="other" />}</KeepAlive>
      ));
      const [edge] = await findEdges();
      await fireEvent.pointerDown(edge as HTMLElement, { ...pointer, clientX: 0, buttons: 1 });
      expect(edge).toHaveAttribute('data-dragging');

      active.value = false;
      await nextTick();
      expect(onDraggingChange.mock.calls).toEqual([[true], [false]]);
      active.value = true;
      await nextTick();

      expect(edge).not.toHaveAttribute('data-dragging');
    });

    it('gives the children slot prop to the #render slot of the root', async () => {
      await render(
        <div style={{ width: '400px', height: '100px' }}>
          <Resizable.Root
            data-testid="root"
            dragEdges
            style={{ height: '100%' }}
            v-slots={{
              render: ({ props, children: Children }: any) => (
                <section {...props}>
                  <Children>
                    <Resizable.Panel id="a" />
                    <Resizable.Panel id="b" />
                  </Children>
                </section>
              ),
            }}
          />
        </div>,
      );

      expect(screen.getByTestId('root').tagName).toBe('SECTION');
      await findEdges();
    });

    it('warns when the #render slot of the root does not mount children', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await render(
        <Resizable.Root
          data-testid="root"
          v-slots={{ render: ({ props }: any) => <section {...props} /> }}
        />,
      );

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toContain('The `#render` slot did not mount `children`');
    });
  });

  describe('a part outside the root', () => {
    // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
    // instance set, and each later case of the file then gets a warning about a slot.
    it('throws a descriptive error for a panel', async () => {
      await expect(render(<Resizable.Panel />)).rejects.toThrow(
        'Vase UI: A part of Resizable must be inside <Resizable.Root>. Without a root the part has no layout to read and no layout to change. Put the part inside <Resizable.Root>.',
      );

      expect(takeReportedMessages()).toEqual([
        expect.stringContaining('Unhandled error during execution of setup function'),
      ]);
    });
  });
});
