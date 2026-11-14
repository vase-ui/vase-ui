import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { KeepAlive, createSSRApp, defineComponent, nextTick, shallowRef } from 'vue';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
  within,
} from '#test-utils';
import { REASONS } from '../../internals/reasons';
import * as Resizable from '../index.parts';
import ResizableRootHydration from './ResizableRootHydration.test.vue';
import ResizableRootLatePanel from './ResizableRootLatePanel.test.vue';

describe('<Resizable.Root />', () => {
  const { render } = createRenderer();

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

    it('gives the state to the slot and to stateClass', async () => {
      await render(
        <Resizable.Root
          data-testid="root"
          orientation="vertical"
          stateClass={(state) => `${state.orientation}-${String(state.disabled)}`}
        >
          {{
            default: ({ state }: { state: { dragging: boolean } }) => `dragging ${state.dragging}`,
          }}
        </Resizable.Root>,
      );

      expect(screen.getByTestId('root')).toHaveClass('vertical-false');
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

    it('warns when it changes from controlled to uncontrolled', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      onTestFinished(() => {
        error.mockRestore();
      });
      const layout = shallowRef<Record<string, number> | undefined>({ a: 50, b: 50, c: 0 });
      await render(() => <Three root={{ layout: layout.value }} />);

      layout.value = undefined;
      await nextTick();

      expect(error).toHaveBeenCalledWith(
        expect.stringMatching(
          /^Vase UI: A component is changing the controlled layout state of Resizable to be uncontrolled\./,
        ),
      );
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

    it('emits no layoutCommitted for a drag that changed nothing', async () => {
      const onLayoutChange = vi.fn();
      const onLayoutCommitted = vi.fn();
      const onDraggingChange = vi.fn();
      await render(<Three root={{ onLayoutChange, onLayoutCommitted, onDraggingChange }} />);
      const handle = screen.getByTestId('handle-a');

      await fireEvent.pointerDown(handle, { ...pointer, clientX: 0, buttons: 1 });
      await fireEvent.pointerMove(handle, { ...pointer, clientX: 0, buttons: 1 });
      await fireEvent.pointerUp(handle, { ...pointer, clientX: 0 });

      expect(onLayoutChange).not.toHaveBeenCalled();
      expect(onLayoutCommitted).not.toHaveBeenCalled();
      expect(onDraggingChange).toHaveBeenCalledTimes(2);
    });

    it('emits no change when a move gives the layout that the panels show', async () => {
      const onLayoutChange = vi.fn();
      await render(<Three root={{ onLayoutChange }} />);

      await drag('handle-a', 0.0001);

      expect(onLayoutChange).not.toHaveBeenCalled();
    });

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

    it('gives the layout of the panels that stay after the last panel unmounts', async () => {
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
      expect(onLayoutChange).toHaveBeenCalledWith(
        { a: 50, b: 50 },
        expect.objectContaining({ reason: REASONS.none }),
      );
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
            {ids.value.flatMap((id, index) => [
              index > 0 ? (
                <Resizable.Handle key={`handle-${id}`} data-testid={`before-${id}`} />
              ) : null,
              <Resizable.Panel key={id} id={id} data-testid={id} />,
            ])}
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
      { name: 'the style of a consumer', composition: 'style', grows: ['30', '70'] },
    ])('hydrates $name with no warning and no mismatch left', async ({ composition, grows }) => {
      const props = { composition };
      const serverHtml = await renderOnServer(
        'src/resizable/root/ResizableRootHydration.test.vue',
        props,
      );

      const { container } = await hydrate(ResizableRootHydration, { serverHtml, props });

      expect(growsIn(container)).toEqual(grows);
      expect(container.querySelectorAll('[data-allow-mismatch]')).toHaveLength(0);
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
