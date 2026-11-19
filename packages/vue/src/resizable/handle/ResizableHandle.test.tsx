import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { h, nextTick, shallowRef } from 'vue';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import {
  createRenderer,
  describeConformance,
  expectNoAxeViolations,
  fireEvent,
  hydrate,
  removedPartHydrationTests,
  renderOnServer,
  screen,
} from '#test-utils';
import { REASONS } from '../../internals/reasons';
import { Resizable } from '@vase-ui/vue/resizable';
import ResizableRootHydration from '../root/ResizableRootHydration.test.vue';

describe('<Resizable.Handle />', () => {
  const { render } = createRenderer();

  interface PanelsOptions {
    root?: Record<string, unknown>;
    panels?: Record<string, unknown>[];
    handle?: Record<string, unknown>;
    renderHandle?: InstanceType<typeof Resizable.Handle>['$slots']['render'];
    direction?: 'ltr' | 'rtl';
  }

  // The container is 1000 px wide and 400 px high, and a handle has no size, so 1% of the panel
  // space is 10 px on a horizontal axis and 4 px on a vertical axis.
  function renderPanels({
    root,
    panels = [{ id: 'a' }, { id: 'b' }],
    handle,
    renderHandle,
    direction = 'ltr',
  }: PanelsOptions = {}) {
    return render(
      <DirectionProvider direction={direction}>
        <div dir={direction} style={{ width: '1000px', height: '400px' }}>
          <Resizable.Root data-testid="root" style={{ height: '100%' }} {...root}>
            {() =>
              panels.flatMap((panel, index) => [
                index > 0 ? (
                  <Resizable.Handle
                    key={`handle-${index}`}
                    data-testid={`handle-${index}`}
                    {...handle}
                    v-slots={renderHandle ? { render: renderHandle } : undefined}
                  />
                ) : null,
                <Resizable.Panel
                  key={`panel-${index}`}
                  data-testid={`panel-${index}`}
                  {...panel}
                />,
              ])
            }
          </Resizable.Root>
        </div>
      </DirectionProvider>,
    );
  }

  function pointerInit(init: PointerEventInit) {
    return { pointerId: 1, pointerType: 'mouse', ...init };
  }

  async function drag(handle: HTMLElement, from: number, to: number, init: PointerEventInit = {}) {
    const horizontal = handle.getAttribute('aria-orientation') === 'vertical';
    const at = (position: number) => (horizontal ? { clientX: position } : { clientY: position });
    await fireEvent.pointerDown(handle, pointerInit({ ...at(from), buttons: 1, ...init }));
    await fireEvent.pointerMove(handle, pointerInit({ ...at(to), buttons: 1, ...init }));
    await fireEvent.pointerUp(handle, pointerInit({ ...at(to), ...init }));
  }

  const sizeOf = (index: number) =>
    screen.getByTestId(`panel-${index}`).getBoundingClientRect().width;

  function matchCoarsePointer() {
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
  }

  const preview = (handle: HTMLElement) =>
    handle.style.getPropertyValue('--resizable-handle-preview-offset');

  describeConformance(<Resizable.Handle />, () => ({
    render: (node) =>
      render(
        <Resizable.Root>
          <Resizable.Panel />
          {node}
          <Resizable.Panel />
        </Resizable.Root>,
      ),
    refInstanceof: window.HTMLDivElement,
    childrenSelector: '[data-vase-ui-resizable-hit-area]',
  }));

  describe('attributes', () => {
    it.each([
      { name: 'a horizontal root', orientation: 'horizontal', expected: 'vertical' },
      { name: 'a vertical root', orientation: 'vertical', expected: 'horizontal' },
    ] as const)('is a focusable separator across $name', async ({ orientation, expected }) => {
      await renderPanels({ root: { orientation } });
      const handle = screen.getByTestId('handle-1');

      expect(handle).toHaveAttribute('role', 'separator');
      expect(handle).toHaveAttribute('tabindex', '0');
      expect(handle).toHaveAttribute('aria-orientation', expected);
      expect(handle).toHaveAttribute('data-orientation', orientation);
    });

    it('gives the value of the panel before it, with the least and the greatest value', async () => {
      await renderPanels({
        panels: [
          { id: 'a', minSize: 10 },
          { id: 'b', minSize: 20 },
          { id: 'c', minSize: 10 },
        ],
        root: { defaultLayout: { a: 40, b: 30, c: 30 } },
      });

      const first = screen.getByTestId('handle-1');
      expect(first).toHaveAttribute('aria-valuenow', '40');
      expect(first).toHaveAttribute('aria-valuemin', '10');
      expect(first).toHaveAttribute('aria-valuemax', '70');
      expect(first).toHaveAttribute('aria-controls', 'a');

      const second = screen.getByTestId('handle-2');
      expect(second).toHaveAttribute('aria-valuenow', '30');
      expect(second).toHaveAttribute('aria-valuemin', '20');
      expect(second).toHaveAttribute('aria-valuemax', '50');
      expect(second).toHaveAttribute('aria-controls', 'b');
    });

    it('gives the value of the panel after it with primaryPanel="next"', async () => {
      await renderPanels({
        panels: [
          { id: 'a', minSize: 10 },
          { id: 'b', minSize: 20 },
          { id: 'c', minSize: 10 },
        ],
        root: { defaultLayout: { a: 40, b: 30, c: 30 } },
        handle: { primaryPanel: 'next' },
      });

      const first = screen.getByTestId('handle-1');
      expect(first).toHaveAttribute('aria-valuenow', '30');
      expect(first).toHaveAttribute('aria-valuemin', '20');
      expect(first).toHaveAttribute('aria-valuemax', '60');
      expect(first).toHaveAttribute('aria-controls', 'b');

      const second = screen.getByTestId('handle-2');
      expect(second).toHaveAttribute('aria-valuenow', '30');
      expect(second).toHaveAttribute('aria-valuemin', '10');
      expect(second).toHaveAttribute('aria-valuemax', '70');
      expect(second).toHaveAttribute('aria-controls', 'c');
    });

    it('rounds the values to whole numbers', async () => {
      await renderPanels({
        panels: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        root: { defaultLayout: { a: 33.4, b: 33.3, c: 33.3 } },
      });

      expect(screen.getByTestId('handle-1')).toHaveAttribute('aria-valuenow', '33');
      expect(screen.getByTestId('handle-1')).toHaveAttribute('aria-valuemax', '100');
      expect(screen.getByTestId('handle-2')).toHaveAttribute('aria-valuemax', '67');
    });

    it('follows a key and a drag', async () => {
      await renderPanels();
      const handle = screen.getByTestId('handle-1');
      expect(handle).toHaveAttribute('aria-valuenow', '50');

      await drag(handle, 0, 100);
      expect(handle).toHaveAttribute('aria-valuenow', '60');

      handle.focus();
      await fireEvent.keyDown(handle, { key: 'ArrowLeft' });
      expect(handle).toHaveAttribute('aria-valuenow', '59');
    });

    it('has no value attribute and no tab stop when it has no panel on one side', async () => {
      const { container } = await render(
        <Resizable.Root>
          <Resizable.Handle data-testid="first" aria-label="First" />
          <Resizable.Panel id="a" />
          <Resizable.Handle data-testid="between" aria-label="Between" />
          <Resizable.Panel id="b" />
          <Resizable.Handle data-testid="last" aria-label="Last" />
        </Resizable.Root>,
      );

      for (const testId of ['first', 'last']) {
        const handle = screen.getByTestId(testId);
        expect(handle).toHaveAttribute('role', 'separator');
        expect(handle).not.toHaveAttribute('aria-valuenow');
        expect(handle).not.toHaveAttribute('aria-controls');
        expect(handle).not.toHaveAttribute('tabindex');
      }
      expect(screen.getByTestId('between')).toHaveAttribute('aria-valuenow', '50');
      expect(screen.getByTestId('between')).toHaveAttribute('tabindex', '0');
      // A separator in the tab order needs a value.
      await expectNoAxeViolations(container);
    });

    it('leaves the focus when it loses the panel on one side', async () => {
      const showB = shallowRef(true);
      await render(() => (
        <Resizable.Root>
          <Resizable.Panel id="a" />
          <Resizable.Handle data-testid="handle" />
          {showB.value ? <Resizable.Panel id="b" /> : null}
        </Resizable.Root>
      ));
      const handle = screen.getByTestId('handle');
      handle.focus();
      expect(handle).toHaveFocus();

      showB.value = false;
      await nextTick();

      expect(handle).not.toHaveAttribute('tabindex');
      expect(handle).not.toHaveFocus();
    });

    it('does nothing when it has no panel on one side', async () => {
      const onLayoutChange = vi.fn();
      await render(
        <div style={{ width: '1000px' }}>
          <Resizable.Root onLayoutChange={onLayoutChange}>
            <Resizable.Handle data-testid="first" />
            <Resizable.Panel id="a" />
            <Resizable.Panel id="b" />
          </Resizable.Root>
        </div>,
      );
      const handle = screen.getByTestId('first');

      handle.focus();
      await fireEvent.keyDown(handle, { key: 'Home' });
      await drag(handle, 0, 100);

      expect(onLayoutChange).not.toHaveBeenCalled();
      expect(handle).not.toHaveAttribute('data-dragging');
    });

    it('has the inline style that keeps the pointer for the drag, and sets no cursor', async () => {
      await renderPanels();
      const handle = screen.getByTestId('handle-1');
      const style = getComputedStyle(handle);

      expect(style.touchAction).toBe('none');
      expect(style.userSelect || style.getPropertyValue('-webkit-user-select')).toBe('none');
      expect(handle.style.cursor).toBe('');
    });

    it('passes axe', async () => {
      const { container } = await renderPanels({ handle: { 'aria-label': 'Resize' } });

      await expectNoAxeViolations(container);
    });
  });

  describe('keys', () => {
    // A key moves the handle on the screen. Page Up and End grow the panel before the handle.
    it.each([
      { name: 'ArrowRight', orientation: 'horizontal', dir: 'ltr', key: '{ArrowRight}', size: 51 },
      { name: 'ArrowLeft', orientation: 'horizontal', dir: 'ltr', key: '{ArrowLeft}', size: 49 },
      {
        name: 'Shift ArrowRight',
        orientation: 'horizontal',
        dir: 'ltr',
        key: '{Shift>}{ArrowRight}{/Shift}',
        size: 60,
      },
      {
        name: 'ArrowRight in RTL',
        orientation: 'horizontal',
        dir: 'rtl',
        key: '{ArrowRight}',
        size: 49,
      },
      {
        name: 'ArrowLeft in RTL',
        orientation: 'horizontal',
        dir: 'rtl',
        key: '{ArrowLeft}',
        size: 51,
      },
      {
        name: 'Shift ArrowLeft in RTL',
        orientation: 'horizontal',
        dir: 'rtl',
        key: '{Shift>}{ArrowLeft}{/Shift}',
        size: 60,
      },
      { name: 'ArrowDown', orientation: 'vertical', dir: 'ltr', key: '{ArrowDown}', size: 51 },
      { name: 'ArrowUp', orientation: 'vertical', dir: 'ltr', key: '{ArrowUp}', size: 49 },
      {
        name: 'ArrowDown in RTL',
        orientation: 'vertical',
        dir: 'rtl',
        key: '{ArrowDown}',
        size: 51,
      },
      { name: 'PageUp', orientation: 'horizontal', dir: 'ltr', key: '{PageUp}', size: 60 },
      { name: 'PageDown', orientation: 'horizontal', dir: 'ltr', key: '{PageDown}', size: 40 },
      { name: 'PageUp in RTL', orientation: 'horizontal', dir: 'rtl', key: '{PageUp}', size: 60 },
      { name: 'Home', orientation: 'horizontal', dir: 'ltr', key: '{Home}', size: 10 },
      { name: 'End', orientation: 'horizontal', dir: 'ltr', key: '{End}', size: 90 },
      {
        name: 'Home in a vertical root',
        orientation: 'vertical',
        dir: 'ltr',
        key: '{Home}',
        size: 10,
      },
    ] as const)('moves the handle with $name', async ({ orientation, dir, key, size }) => {
      const { user } = await renderPanels({
        root: { orientation },
        panels: [
          { id: 'a', minSize: 10, maxSize: 90 },
          { id: 'b', minSize: 10, maxSize: 90 },
        ],
        direction: dir,
      });
      const handle = screen.getByTestId('handle-1');

      handle.focus();
      await user.keyboard(key);

      expect(handle).toHaveAttribute('aria-valuenow', String(size));
    });

    it.each([
      { name: 'ArrowUp in a horizontal root', orientation: 'horizontal', key: '{ArrowUp}' },
      { name: 'ArrowDown in a horizontal root', orientation: 'horizontal', key: '{ArrowDown}' },
      { name: 'ArrowLeft in a vertical root', orientation: 'vertical', key: '{ArrowLeft}' },
      { name: 'ArrowRight in a vertical root', orientation: 'vertical', key: '{ArrowRight}' },
    ] as const)('keeps the default of $name', async ({ orientation, key }) => {
      const { user } = await renderPanels({ root: { orientation } });
      const handle = screen.getByTestId('handle-1');
      const keydown = vi.fn((event: KeyboardEvent) => event.defaultPrevented);
      handle.addEventListener('keydown', keydown);

      handle.focus();
      await user.keyboard(key);

      expect(keydown).toHaveLastReturnedWith(false);
      expect(handle).toHaveAttribute('aria-valuenow', '50');
    });

    it('moves the handle with the step and the large step of the root', async () => {
      const { user } = await renderPanels({ root: { step: 2.5, largeStep: 20 } });
      const handle = screen.getByTestId('handle-1');

      handle.focus();
      await user.keyboard('{ArrowRight}');
      expect(handle).toHaveAttribute('aria-valuenow', '53');
      await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
      expect(handle).toHaveAttribute('aria-valuenow', '73');
      await user.keyboard('{PageDown}');
      expect(handle).toHaveAttribute('aria-valuenow', '53');
    });

    it('prevents the default of a key that it handles', async () => {
      await renderPanels();
      const handle = screen.getByTestId('handle-1');

      expect(await fireEvent.keyDown(handle, { key: 'ArrowRight' })).toBe(false);
      // The handle is at its greatest value after End, and the key is still its own.
      await fireEvent.keyDown(handle, { key: 'End' });
      expect(await fireEvent.keyDown(handle, { key: 'End' })).toBe(false);
    });

    it('ignores a key while the handle drags', async () => {
      const onLayoutChange = vi.fn();
      const onLayoutCommitted = vi.fn();
      await renderPanels({ root: { onLayoutChange, onLayoutCommitted } });
      const handle = screen.getByTestId('handle-1');
      await fireEvent.pointerDown(handle, pointerInit({ clientX: 0, buttons: 1 }));
      await fireEvent.pointerMove(handle, pointerInit({ clientX: 100, buttons: 1 }));

      expect(await fireEvent.keyDown(handle, { key: 'ArrowRight' })).toBe(false);

      expect(handle).toHaveAttribute('aria-valuenow', '60');
      expect(onLayoutChange).toHaveBeenCalledTimes(1);
      expect(onLayoutCommitted).not.toHaveBeenCalled();
      await fireEvent.pointerUp(handle, pointerInit({ clientX: 100 }));
      expect(onLayoutCommitted).toHaveBeenCalledTimes(1);
    });

    it.each([
      { name: 'Ctrl', modifier: { ctrlKey: true } },
      { name: 'Alt', modifier: { altKey: true } },
      { name: 'Meta', modifier: { metaKey: true } },
    ])('leaves $name and a key to the browser', async ({ modifier }) => {
      await renderPanels();
      const handle = screen.getByTestId('handle-1');

      expect(await fireEvent.keyDown(handle, { key: 'ArrowLeft', ...modifier })).toBe(true);
      expect(handle).toHaveAttribute('aria-valuenow', '50');
    });

    it.each([
      {
        name: 'preventDefault()',
        onKeydown: (event: KeyboardEvent) => {
          event.preventDefault();
        },
      },
      {
        name: 'preventVaseUIHandler()',
        onKeydown: (event: KeyboardEvent & { preventVaseUIHandler: () => void }) => {
          event.preventVaseUIHandler();
        },
      },
    ])('does not handle a key after a listener calls $name', async ({ onKeydown }) => {
      await renderPanels({ handle: { onKeydown } });
      const handle = screen.getByTestId('handle-1');

      await fireEvent.keyDown(handle, { key: 'ArrowRight' });

      expect(handle).toHaveAttribute('aria-valuenow', '50');
    });

    it('moves the panel after the handle with primaryPanel="next"', async () => {
      const { user } = await renderPanels({
        handle: { primaryPanel: 'next' },
        panels: [
          { id: 'a', minSize: 10, maxSize: 90 },
          { id: 'b', minSize: 20, maxSize: 70 },
        ],
      });
      const handle = screen.getByTestId('handle-1');
      handle.focus();

      // The panel after the handle is the primary panel, so Page Up grows it.
      await user.keyboard('{PageUp}');
      expect(handle).toHaveAttribute('aria-valuenow', '60');
      await user.keyboard('{Home}');
      expect(handle).toHaveAttribute('aria-valuenow', '20');
      await user.keyboard('{End}');
      expect(handle).toHaveAttribute('aria-valuenow', '70');
      // An arrow key moves the handle on the screen, for each primary panel.
      await user.keyboard('{ArrowRight}');
      expect(handle).toHaveAttribute('aria-valuenow', '69');
    });
  });

  describe('pointer', () => {
    it.each([
      { name: 'horizontal', orientation: 'horizontal', from: 0, to: 100, expected: 60 },
      { name: 'vertical', orientation: 'vertical', from: 0, to: 80, expected: 70 },
    ] as const)('drags the handle in a $name root', async ({ orientation, from, to, expected }) => {
      await renderPanels({ root: { orientation } });
      const handle = screen.getByTestId('handle-1');

      await drag(handle, from, to);

      expect(handle).toHaveAttribute('aria-valuenow', String(expected));
    });

    it('drags toward the previous panel in an RTL root', async () => {
      await renderPanels({ direction: 'rtl' });
      const handle = screen.getByTestId('handle-1');

      await drag(handle, 500, 600);

      expect(handle).toHaveAttribute('aria-valuenow', '40');
    });

    it.each([
      { name: 'a touch', pointerType: 'touch' },
      { name: 'a pen', pointerType: 'pen' },
    ])('drags the handle with $name', async ({ pointerType }) => {
      await renderPanels();
      const handle = screen.getByTestId('handle-1');

      await drag(handle, 0, 100, { pointerType });

      expect(handle).toHaveAttribute('aria-valuenow', '60');
    });

    it('moves the panels on the screen with the pointer', async () => {
      await renderPanels({ panels: [{ id: 'a' }, { id: 'b' }, { id: 'c', defaultSize: 20 }] });
      const handle = screen.getByTestId('handle-1');

      expect(sizeOf(0)).toBeCloseTo(400, 0);
      await drag(handle, 0, 250);

      expect(sizeOf(0)).toBeCloseTo(650, 0);
      expect(sizeOf(1)).toBeCloseTo(150, 0);
      expect(sizeOf(2)).toBeCloseTo(200, 0);
    });

    it('computes a move from the layout at the start', async () => {
      const onLayoutChange = vi.fn();
      await renderPanels({ root: { onLayoutChange } });
      const handle = screen.getByTestId('handle-1');

      await fireEvent.pointerDown(handle, pointerInit({ clientX: 100, buttons: 1 }));
      await fireEvent.pointerMove(handle, pointerInit({ clientX: 400, buttons: 1 }));
      expect(handle).toHaveAttribute('aria-valuenow', '80');
      await fireEvent.pointerMove(handle, pointerInit({ clientX: 100, buttons: 1 }));

      expect(onLayoutChange).toHaveBeenLastCalledWith({ a: 50, b: 50 }, expect.anything());
      expect(handle).toHaveAttribute('aria-valuenow', '50');
    });

    it('takes from the next panel first, then from the one after it', async () => {
      await renderPanels({
        panels: [{ id: 'a' }, { id: 'b', minSize: 20 }, { id: 'c', minSize: 10 }],
        root: { defaultLayout: { a: 40, b: 30, c: 30 } },
      });

      await drag(screen.getByTestId('handle-1'), 0, 250);

      expect(screen.getByTestId('handle-1')).toHaveAttribute('aria-valuenow', '65');
      expect(screen.getByTestId('handle-2')).toHaveAttribute('aria-valuenow', '20');
      expect(screen.getByTestId('panel-2').style.flexGrow).toBe('15');
    });

    it('focuses the handle with the press, and does not prevent the default of the press', async () => {
      await renderPanels();
      const handle = screen.getByTestId('handle-1');

      expect(await fireEvent.pointerDown(handle, pointerInit({ buttons: 1 }))).toBe(true);

      expect(handle).toHaveFocus();
    });

    it('prevents the default of the mousedown of a press that started a drag, so that no text is selected', async () => {
      await renderPanels();
      const handle = screen.getByTestId('handle-1');

      await fireEvent.pointerDown(handle, pointerInit({ buttons: 1 }));
      expect(await fireEvent.mouseDown(handle)).toBe(false);
      await fireEvent.pointerUp(handle, pointerInit({}));

      expect(await fireEvent.mouseDown(handle)).toBe(true);
    });

    it.each([
      { name: 'another button', down: { button: 2, buttons: 2 } },
      { name: 'a press that is prevented', down: { buttons: 1 }, prevent: true },
    ])('keeps the default of a mousedown after $name', async ({ down, prevent }) => {
      await renderPanels({
        handle: prevent
          ? {
              onPointerdown: (event: PointerEvent) => {
                event.preventDefault();
              },
            }
          : undefined,
      });
      const handle = screen.getByTestId('handle-1');

      await fireEvent.pointerDown(handle, pointerInit(down));

      expect(await fireEvent.mouseDown(handle)).toBe(true);
      expect(handle).not.toHaveFocus();
    });

    it('does not start a drag with another button', async () => {
      await renderPanels();
      const handle = screen.getByTestId('handle-1');

      await fireEvent.pointerDown(handle, pointerInit({ button: 2, buttons: 2 }));
      await fireEvent.pointerMove(handle, pointerInit({ clientX: 100, buttons: 2 }));

      expect(handle).not.toHaveAttribute('data-dragging');
      expect(handle).toHaveAttribute('aria-valuenow', '50');
    });

    it.each([
      {
        name: 'preventDefault()',
        onPointerdown: (event: PointerEvent) => {
          event.preventDefault();
        },
      },
      {
        name: 'preventVaseUIHandler()',
        onPointerdown: (event: PointerEvent & { preventVaseUIHandler: () => void }) => {
          event.preventVaseUIHandler();
        },
      },
    ])('does not start a drag after a listener calls $name', async ({ onPointerdown }) => {
      await renderPanels({ handle: { onPointerdown } });
      const handle = screen.getByTestId('handle-1');

      await fireEvent.pointerDown(handle, pointerInit({ buttons: 1 }));
      await fireEvent.pointerMove(handle, pointerInit({ clientX: 100, buttons: 1 }));

      expect(handle).not.toHaveAttribute('data-dragging');
      expect(handle).toHaveAttribute('aria-valuenow', '50');
    });

    it('sets data-dragging from the press to the release', async () => {
      await renderPanels();
      const handle = screen.getByTestId('handle-1');

      await fireEvent.pointerDown(handle, pointerInit({ buttons: 1 }));
      expect(handle).toHaveAttribute('data-dragging');
      await fireEvent.pointerUp(handle, pointerInit({}));

      expect(handle).not.toHaveAttribute('data-dragging');
    });

    it.each([
      {
        name: 'a move with no button down',
        end: (handle: HTMLElement) =>
          fireEvent.pointerMove(handle, pointerInit({ clientX: 10, buttons: 0 })),
      },
      {
        name: 'pointercancel',
        end: (handle: HTMLElement) => fireEvent.pointerCancel(handle, pointerInit({})),
      },
      {
        name: 'lostpointercapture',
        end: (handle: HTMLElement) => fireEvent.lostPointerCapture(handle, pointerInit({})),
      },
    ])('ends the drag with $name', async ({ end }) => {
      await renderPanels();
      const handle = screen.getByTestId('handle-1');

      await fireEvent.pointerDown(handle, pointerInit({ buttons: 1 }));
      await end(handle);
      expect(handle).not.toHaveAttribute('data-dragging');
      await fireEvent.pointerMove(handle, pointerInit({ clientX: 100, buttons: 1 }));

      expect(handle).toHaveAttribute('aria-valuenow', '50');
    });

    it('ignores the events of a pointer that did not start the drag', async () => {
      await renderPanels();
      const handle = screen.getByTestId('handle-1');

      await fireEvent.pointerDown(handle, pointerInit({ buttons: 1 }));
      await fireEvent.pointerMove(handle, pointerInit({ pointerId: 2, clientX: 100, buttons: 1 }));
      await fireEvent.pointerUp(handle, pointerInit({ pointerId: 2 }));

      expect(handle).toHaveAttribute('aria-valuenow', '50');
      expect(handle).toHaveAttribute('data-dragging');
    });

    it('starts no drag when the panels have no size', async () => {
      await render(
        <div style={{ width: '1000px', display: 'none' }}>
          <Resizable.Root>
            <Resizable.Panel id="a" />
            <Resizable.Handle data-testid="handle" />
            <Resizable.Panel id="b" />
          </Resizable.Root>
        </div>,
      );
      const handle = screen.getByTestId('handle');

      await fireEvent.pointerDown(handle, pointerInit({ buttons: 1 }));

      expect(handle).not.toHaveAttribute('data-dragging');
    });

    it('ends the drag when a panel mounts during it', async () => {
      const showLate = shallowRef(false);
      const onLayoutChange = vi.fn();
      await render(() => (
        <div style={{ width: '1000px', height: '400px' }}>
          <Resizable.Root onLayoutChange={onLayoutChange}>
            <Resizable.Panel id="a" />
            <Resizable.Handle data-testid="handle" />
            <Resizable.Panel id="b" />
            {showLate.value ? <Resizable.Panel id="late" /> : null}
          </Resizable.Root>
        </div>
      ));
      const handle = screen.getByTestId('handle');

      await fireEvent.pointerDown(handle, pointerInit({ buttons: 1 }));
      showLate.value = true;
      await nextTick();
      onLayoutChange.mockClear();
      await fireEvent.pointerMove(handle, pointerInit({ clientX: 100, buttons: 1 }));

      expect(handle).not.toHaveAttribute('data-dragging');
      expect(onLayoutChange).not.toHaveBeenCalled();
    });

    it('keeps a consumer pointerdown listener beside the drag', async () => {
      const onPointerdown = vi.fn();
      await renderPanels({ handle: { onPointerdown } });
      const handle = screen.getByTestId('handle-1');

      await drag(handle, 0, 100);

      expect(onPointerdown).toHaveBeenCalledTimes(1);
      expect(handle).toHaveAttribute('aria-valuenow', '60');
    });
  });

  describe('prop: disabled', () => {
    it('ignores a drag and a key', async () => {
      const onLayoutChange = vi.fn();
      const { user } = await renderPanels({
        root: { onLayoutChange },
        handle: { disabled: true },
      });
      const handle = screen.getByTestId('handle-1');

      await drag(handle, 0, 100);
      await user.click(handle);
      await fireEvent.keyDown(handle, { key: 'ArrowRight' });

      expect(onLayoutChange).not.toHaveBeenCalled();
      expect(handle).toHaveAttribute('data-disabled');
    });

    it('is not in the tab order and has no value attribute', async () => {
      await renderPanels({ handle: { disabled: true } });
      const handle = screen.getByTestId('handle-1');

      expect(handle).toHaveAttribute('aria-disabled', 'true');
      expect(handle).not.toHaveAttribute('tabindex');
      expect(handle).not.toHaveAttribute('aria-valuenow');
      expect(handle).not.toHaveAttribute('aria-valuemin');
      expect(handle).not.toHaveAttribute('aria-valuemax');
    });

    it('passes axe', async () => {
      const { container } = await renderPanels({
        handle: { disabled: true, 'aria-label': 'Resize' },
      });

      await expectNoAxeViolations(container);
    });

    it('leaves the focus and ends the drag when it becomes disabled', async () => {
      const disabled = shallowRef(false);
      await render(() => (
        <div style={{ width: '1000px' }}>
          <Resizable.Root>
            <Resizable.Panel id="a" />
            <Resizable.Handle data-testid="handle" disabled={disabled.value} />
            <Resizable.Panel id="b" />
          </Resizable.Root>
        </div>
      ));
      const handle = screen.getByTestId('handle');
      handle.focus();
      await fireEvent.pointerDown(handle, pointerInit({ buttons: 1 }));
      expect(handle).toHaveAttribute('data-dragging');

      disabled.value = true;
      await nextTick();

      expect(handle).not.toHaveFocus();
      expect(handle).not.toHaveAttribute('data-dragging');
    });

    it('is disabled by the root', async () => {
      await renderPanels({ root: { disabled: true } });
      const handle = screen.getByTestId('handle-1');

      expect(handle).toHaveAttribute('aria-disabled', 'true');
      expect(handle).toHaveAttribute('data-disabled');
      expect(handle).not.toHaveAttribute('tabindex');
    });
  });

  describe('collapse', () => {
    // The container is 1000 px wide, so 10 px are 1%. The first panel is 40% and collapses to 0.
    const collapsible = { id: 'a', collapsible: true, minSize: 20, defaultSize: 40 };
    const grow = (index: number) => screen.getByTestId(`panel-${index}`).style.flexGrow;

    it('collapses with Enter and gives back its size with the next Enter', async () => {
      const onLayoutChange = vi.fn();
      const onLayoutCommitted = vi.fn();
      await renderPanels({
        root: { onLayoutChange, onLayoutCommitted },
        panels: [collapsible, { id: 'b' }],
      });
      const handle = screen.getByTestId('handle-1');
      handle.focus();

      expect(await fireEvent.keyDown(handle, { key: 'Enter' })).toBe(false);
      expect(handle).toHaveAttribute('aria-valuenow', '0');
      expect(screen.getByTestId('panel-0')).toHaveAttribute('data-collapsed');
      expect([grow(0), grow(1)]).toEqual(['0', '100']);

      await fireEvent.keyDown(handle, { key: 'Enter' });
      expect(handle).toHaveAttribute('aria-valuenow', '40');
      expect(screen.getByTestId('panel-0')).not.toHaveAttribute('data-collapsed');
      expect([grow(0), grow(1)]).toEqual(['40', '60']);

      expect(onLayoutChange.mock.calls.map(([, details]) => details.reason)).toEqual([
        REASONS.keyboard,
        REASONS.keyboard,
      ]);
      expect(onLayoutChange.mock.calls[0]?.[1].event.type).toBe('keydown');
      expect(onLayoutCommitted.mock.calls.map(([, details]) => details.reason)).toEqual([
        REASONS.keyboard,
        REASONS.keyboard,
      ]);
    });

    it('gives back the least size with Enter when the panel has no size from before', async () => {
      await renderPanels({ panels: [{ ...collapsible, defaultSize: 0 }, { id: 'b' }] });
      const handle = screen.getByTestId('handle-1');
      handle.focus();

      await fireEvent.keyDown(handle, { key: 'Enter' });

      expect([grow(0), grow(1)]).toEqual(['20', '80']);
    });

    it.each([
      { name: 'pushes the next panel', pushPanels: true, expected: ['20', '20', '60'] },
      { name: 'stops at the next panel', pushPanels: false, expected: ['0', '20', '80'] },
    ])('expands with Enter and a root that $name', async ({ pushPanels, expected }) => {
      await renderPanels({
        root: { pushPanels, defaultLayout: { a: 0, b: 20, c: 80 } },
        panels: [
          { id: 'a', collapsible: true, minSize: 20 },
          { id: 'b', minSize: 20 },
          { id: 'c' },
        ],
      });
      const handle = screen.getByTestId('handle-1');
      handle.focus();

      await fireEvent.keyDown(handle, { key: 'Enter' });

      expect([grow(0), grow(1), grow(2)]).toEqual(expected);
    });

    it('ignores Enter while the handle drags', async () => {
      const onLayoutChange = vi.fn();
      await renderPanels({ root: { onLayoutChange }, panels: [collapsible, { id: 'b' }] });
      const handle = screen.getByTestId('handle-1');
      await fireEvent.pointerDown(handle, pointerInit({ clientX: 0, buttons: 1 }));
      await fireEvent.pointerMove(handle, pointerInit({ clientX: 100, buttons: 1 }));
      onLayoutChange.mockClear();

      expect(await fireEvent.keyDown(handle, { key: 'Enter' })).toBe(false);

      expect(onLayoutChange).not.toHaveBeenCalled();
      expect([grow(0), grow(1)]).toEqual(['50', '50']);
    });

    it('collapses the panel after the handle with Enter and primaryPanel="next"', async () => {
      await renderPanels({
        handle: { primaryPanel: 'next' },
        panels: [{ id: 'a' }, { id: 'b', collapsible: true, minSize: 20, defaultSize: 30 }],
      });
      const handle = screen.getByTestId('handle-1');
      handle.focus();

      await fireEvent.keyDown(handle, { key: 'Enter' });
      expect([grow(0), grow(1)]).toEqual(['100', '0']);
      expect(handle).toHaveAttribute('aria-valuenow', '0');

      await fireEvent.keyDown(handle, { key: 'Enter' });
      expect([grow(0), grow(1)]).toEqual(['70', '30']);
    });

    it('leaves Enter to the browser when the primary panel is not collapsible', async () => {
      const onLayoutChange = vi.fn();
      await renderPanels({ root: { onLayoutChange } });
      const handle = screen.getByTestId('handle-1');
      handle.focus();

      expect(await fireEvent.keyDown(handle, { key: 'Enter' })).toBe(true);

      expect(onLayoutChange).not.toHaveBeenCalled();
    });

    it('collapses a collapsible primary panel with Home', async () => {
      const { user } = await renderPanels({ panels: [collapsible, { id: 'b' }] });
      const handle = screen.getByTestId('handle-1');
      handle.focus();
      expect(handle).toHaveAttribute('aria-valuemin', '0');

      await user.keyboard('{Home}');

      expect([grow(0), grow(1)]).toEqual(['0', '100']);
      expect(handle).toHaveAttribute('aria-valuenow', '0');
    });

    it('collapses at once from the least size with an arrow key, and expands at once', async () => {
      const { user } = await renderPanels({
        panels: [{ ...collapsible, defaultSize: 20 }, { id: 'b' }],
      });
      const handle = screen.getByTestId('handle-1');
      handle.focus();

      await user.keyboard('{ArrowLeft}');
      expect([grow(0), grow(1)]).toEqual(['0', '100']);

      await user.keyboard('{ArrowRight}');
      expect([grow(0), grow(1)]).toEqual(['20', '80']);
    });

    it('collapses the panel before the second handle with Enter, and gives its space to the next', async () => {
      const { user } = await renderPanels({
        root: { defaultLayout: { a: 30, b: 30, c: 40 } },
        panels: [{ id: 'a' }, { id: 'b', collapsible: true, minSize: 20 }, { id: 'c' }],
      });
      const second = screen.getByTestId('handle-2');
      second.focus();

      // The second handle is after the panel b, so it moves b to the left with its space going
      // to the panel c.
      await user.keyboard('{Enter}');
      expect([grow(0), grow(1), grow(2)]).toEqual(['30', '0', '70']);
      expect(screen.getByTestId('handle-1')).toHaveAttribute('aria-valuenow', '30');
      expect(second).toHaveAttribute('aria-valuenow', '0');
    });

    it('follows a method of the panel with its values', async () => {
      const instance: { a?: InstanceType<typeof Resizable.Panel> } = {};
      await render(() => (
        <div style={{ width: '1000px', height: '400px' }}>
          <Resizable.Root>
            <Resizable.Panel
              id="a"
              data-testid="panel-0"
              collapsible
              minSize={20}
              defaultSize={40}
              ref={(value) => {
                instance.a = value as InstanceType<typeof Resizable.Panel>;
              }}
            />
            <Resizable.Handle data-testid="handle-1" />
            <Resizable.Panel id="b" data-testid="panel-1" />
          </Resizable.Root>
        </div>
      ));
      const handle = screen.getByTestId('handle-1');
      expect(handle).toHaveAttribute('aria-valuenow', '40');

      instance.a?.collapse();
      await nextTick();

      expect(handle).toHaveAttribute('aria-valuenow', '0');
      expect(handle).toHaveAttribute('data-at-min');
    });
  });

  describe('double click', () => {
    it.each([
      {
        name: 'the size of the panel at the start',
        root: {},
        handle: {},
        panels: [{ id: 'a', defaultSize: 30 }, { id: 'b' }],
        expected: ['30', '70'],
      },
      {
        name: 'the default layout',
        root: { defaultLayout: { a: 20, b: 80 } },
        handle: {},
        panels: [{ id: 'a' }, { id: 'b' }],
        expected: ['20', '80'],
      },
      {
        name: 'the share of a panel with no size',
        root: {},
        handle: {},
        panels: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        expected: ['33.334', '33.333', '33.333'],
      },
      {
        name: 'the panel after the handle',
        root: {},
        handle: { primaryPanel: 'next' },
        panels: [{ id: 'a' }, { id: 'b', defaultSize: 30 }],
        expected: ['70', '30'],
      },
    ])(
      'gives the primary panel its first size with a double click: $name',
      async ({ root, handle: handleProps, panels, expected }) => {
        const onLayoutChange = vi.fn();
        const onLayoutCommitted = vi.fn();
        await renderPanels({
          root: { ...root, onLayoutChange, onLayoutCommitted },
          handle: handleProps,
          panels,
        });
        const handle = screen.getByTestId('handle-1');
        await drag(handle, 0, 100);
        onLayoutChange.mockClear();
        onLayoutCommitted.mockClear();

        expect(await fireEvent.dblClick(handle)).toBe(false);

        const grows = panels.map(
          (_panel, index) => screen.getByTestId(`panel-${index}`).style.flexGrow,
        );
        expect(grows).toEqual(expected);
        expect(onLayoutChange).toHaveBeenCalledTimes(1);
        expect(onLayoutChange.mock.calls[0]?.[1].reason).toBe('reset');
        expect(onLayoutChange.mock.calls[0]?.[1].event.type).toBe('dblclick');
        expect(onLayoutCommitted).toHaveBeenCalledTimes(1);
        expect(onLayoutCommitted.mock.calls[0]?.[1].reason).toBe('reset');
        expect(onLayoutCommitted.mock.calls[0]?.[1].event.type).toBe('dblclick');
        expect(onLayoutCommitted.mock.calls[0]?.[0]).toEqual(onLayoutChange.mock.calls[0]?.[0]);
      },
    );

    it.each([
      { name: 'pushes the next panel', pushPanels: true, called: 1 },
      { name: 'stops at the next panel', pushPanels: false, called: 0 },
    ])('gives the first size with a root that $name', async ({ pushPanels, called }) => {
      const onLayoutChange = vi.fn();
      // The panel b has its least size, so only a push gives the panel a its size from the start.
      await renderPanels({
        root: {
          pushPanels,
          layout: { a: 30, b: 20, c: 50 },
          defaultLayout: { a: 50, b: 20, c: 30 },
          onLayoutChange,
        },
        panels: [{ id: 'a' }, { id: 'b', minSize: 20 }, { id: 'c' }],
      });

      await fireEvent.dblClick(screen.getByTestId('handle-1'));

      expect(onLayoutChange).toHaveBeenCalledTimes(called);
      if (called > 0) {
        expect(onLayoutChange.mock.calls[0]?.[0]).toEqual({ a: 50, b: 20, c: 30 });
      }
    });

    it('does nothing for a second double click, and leaves the event to the browser', async () => {
      const onLayoutChange = vi.fn();
      await renderPanels({
        root: { onLayoutChange },
        panels: [{ id: 'a', defaultSize: 30 }, { id: 'b' }],
      });
      const handle = screen.getByTestId('handle-1');
      await drag(handle, 0, 100);
      await fireEvent.dblClick(handle);
      onLayoutChange.mockClear();

      expect(await fireEvent.dblClick(handle)).toBe(true);

      expect(onLayoutChange).not.toHaveBeenCalled();
    });

    it('gives only the primary panel and the panel beside it their first sizes', async () => {
      await renderPanels({
        root: { defaultLayout: { a: 20, b: 30, c: 50 } },
        panels: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      });
      await drag(screen.getByTestId('handle-2'), 0, 100);
      expect([0, 1, 2].map((index) => screen.getByTestId(`panel-${index}`).style.flexGrow)).toEqual(
        ['20', '40', '40'],
      );

      await fireEvent.dblClick(screen.getByTestId('handle-2'));

      expect([0, 1, 2].map((index) => screen.getByTestId(`panel-${index}`).style.flexGrow)).toEqual(
        ['20', '30', '50'],
      );
    });

    it('does nothing for a disabled handle', async () => {
      const onLayoutChange = vi.fn();
      await renderPanels({
        root: { defaultLayout: { a: 40, b: 60 }, onLayoutChange },
        handle: { disabled: true },
        panels: [{ id: 'a', defaultSize: 30 }, { id: 'b' }],
      });

      expect(await fireEvent.dblClick(screen.getByTestId('handle-1'))).toBe(true);

      expect(onLayoutChange).not.toHaveBeenCalled();
    });

    it('does not run after a listener calls preventVaseUIHandler()', async () => {
      const onLayoutChange = vi.fn();
      await renderPanels({
        root: { onLayoutChange },
        handle: {
          onDblclick: (event: MouseEvent & { preventVaseUIHandler: () => void }) => {
            event.preventVaseUIHandler();
          },
        },
        panels: [{ id: 'a', defaultSize: 30 }, { id: 'b' }],
      });
      const handle = screen.getByTestId('handle-1');
      await drag(handle, 0, 100);
      onLayoutChange.mockClear();

      await fireEvent.dblClick(handle);

      expect(onLayoutChange).not.toHaveBeenCalled();
    });
  });

  describe('ends of the travel', () => {
    const bounded = [
      { id: 'a', minSize: 20, maxSize: 60 },
      { id: 'b', minSize: 30 },
    ];
    const ends = (handle: HTMLElement) =>
      ['data-at-min', 'data-at-max'].filter((name) => handle.hasAttribute(name));

    it.each([
      { name: 'at the least size', layout: { a: 20, b: 80 }, expected: ['data-at-min'] },
      { name: 'between the ends', layout: { a: 40, b: 60 }, expected: [] },
      { name: 'at the greatest size', layout: { a: 60, b: 40 }, expected: ['data-at-max'] },
    ])('has the attribute of the end when the handle is $name', async ({ layout, expected }) => {
      await renderPanels({ root: { defaultLayout: layout }, panels: bounded });

      expect(ends(screen.getByTestId('handle-1'))).toEqual(expected);
    });

    it.each([
      {
        name: 'at the top of a vertical root',
        root: { orientation: 'vertical' },
        direction: 'ltr',
        handle: {},
        expected: ['data-at-min'],
      },
      {
        name: 'at the right of a right-to-left root',
        root: {},
        direction: 'rtl',
        handle: {},
        expected: ['data-at-max'],
      },
      {
        name: 'with the panel after the handle',
        root: {},
        direction: 'ltr',
        handle: { primaryPanel: 'next' },
        expected: ['data-at-min'],
      },
    ] as const)(
      'has the attribute of the side of the screen, $name',
      async ({ root, direction, handle, expected }) => {
        await renderPanels({
          root: { ...root, defaultLayout: { a: 20, b: 80 } },
          direction,
          handle,
          panels: bounded,
        });

        expect(ends(screen.getByTestId('handle-1'))).toEqual(expected);
      },
    );

    it('has neither attribute for a collapsible panel at its least size', async () => {
      await renderPanels({
        root: { defaultLayout: { a: 20, b: 80 } },
        panels: [{ id: 'a', collapsible: true, minSize: 20 }, { id: 'b' }],
      });

      expect(ends(screen.getByTestId('handle-1'))).toEqual([]);
    });

    it('has the attribute of the least end when a collapsible panel is collapsed', async () => {
      await renderPanels({
        root: { defaultLayout: { a: 0, b: 100 } },
        panels: [{ id: 'a', collapsible: true, minSize: 20 }, { id: 'b' }],
      });

      expect(ends(screen.getByTestId('handle-1'))).toEqual(['data-at-min']);
    });

    it('has neither attribute when the handle is disabled', async () => {
      await renderPanels({
        root: { defaultLayout: { a: 20, b: 80 } },
        handle: { disabled: true },
        panels: bounded,
      });

      expect(ends(screen.getByTestId('handle-1'))).toEqual([]);
    });

    it('has both attributes when the handle cannot move', async () => {
      await renderPanels({ panels: [{ id: 'a', disabled: true }, { id: 'b' }] });

      expect(ends(screen.getByTestId('handle-1'))).toEqual(['data-at-min', 'data-at-max']);
    });

    it('has both attributes when it has no panel on one side', async () => {
      await render(
        <Resizable.Root>
          <Resizable.Handle data-testid="first" />
          <Resizable.Panel id="a" />
          <Resizable.Handle data-testid="between" />
          <Resizable.Panel id="b" />
          <Resizable.Handle data-testid="last" />
        </Resizable.Root>,
      );

      expect(ends(screen.getByTestId('first'))).toEqual(['data-at-min', 'data-at-max']);
      expect(ends(screen.getByTestId('between'))).toEqual([]);
      expect(ends(screen.getByTestId('last'))).toEqual(['data-at-min', 'data-at-max']);
    });

    it('has both attributes while the panel after it is unmounted', async () => {
      const showB = shallowRef(true);
      await render(() => (
        <Resizable.Root>
          <Resizable.Panel id="a" />
          <Resizable.Handle data-testid="handle" />
          {showB.value ? <Resizable.Panel id="b" /> : null}
        </Resizable.Root>
      ));
      const handle = screen.getByTestId('handle');
      expect(ends(handle)).toEqual([]);

      showB.value = false;
      await nextTick();
      expect(ends(handle)).toEqual(['data-at-min', 'data-at-max']);

      showB.value = true;
      await nextTick();
      expect(ends(handle)).toEqual([]);
    });

    it('gives no end attribute at the mount to a handle with a panel on each side', async () => {
      const changes: string[] = [];
      const observer = new MutationObserver((records) => {
        changes.push(...records.map((record) => record.attributeName ?? ''));
      });
      observer.observe(document.body, {
        subtree: true,
        attributeFilter: ['data-at-min', 'data-at-max'],
      });
      onTestFinished(() => {
        observer.disconnect();
      });

      await renderPanels();
      expect(screen.getByTestId('handle-1')).toHaveAttribute('aria-valuenow', '50');

      changes.push(...observer.takeRecords().map((record) => record.attributeName ?? ''));
      expect(changes).toEqual([]);
    });

    it('gives the current drag limits to the render slot', async () => {
      await renderPanels({
        panels: bounded,
        renderHandle: ({ props, state, children }) => (
          <div {...props} class={`${String(state.atMin)}-${String(state.atMax)}`}>
            {h(children)}
          </div>
        ),
      });
      const handle = screen.getByTestId('handle-1');
      expect(ends(handle)).toEqual([]);
      expect(handle).toHaveClass('false-false');

      await drag(handle, 0, -400);
      expect(ends(handle)).toEqual(['data-at-min']);
      expect(handle).toHaveClass('true-false');

      await drag(handle, 0, 800);
      expect(ends(handle)).toEqual(['data-at-max']);
      expect(handle).toHaveClass('false-true');
    });

    it('counts only the next panel when the root does not push', async () => {
      await renderPanels({
        root: { pushPanels: false, defaultLayout: { a: 30, b: 30, c: 40 } },
        panels: [{ id: 'a' }, { id: 'b', minSize: 30 }, { id: 'c' }],
      });

      expect(ends(screen.getByTestId('handle-1'))).toEqual(['data-at-max']);
    });
  });

  describe('hit area', () => {
    // The handle is 8 px wide in a horizontal root, and 8 px high in a vertical root.
    const handleSize = (orientation: 'horizontal' | 'vertical') => ({
      style:
        orientation === 'horizontal'
          ? { flex: 'none', width: '8px' }
          : { flex: 'none', height: '8px' },
    });

    async function renderHandle(
      orientation: 'horizontal' | 'vertical' = 'horizontal',
      root: Record<string, unknown> = {},
      handle: Record<string, unknown> = {},
    ) {
      await renderPanels({
        root: { orientation, ...root },
        handle: { ...handleSize(orientation), ...handle },
      });
      const element = screen.getByTestId('handle-1');
      const area = element.lastElementChild as HTMLElement;
      return { element, area, rect: element.getBoundingClientRect() };
    }

    it('renders one node as the last child of the handle, after the content of the consumer', async () => {
      await render(
        <Resizable.Root>
          <Resizable.Panel />
          <Resizable.Handle data-testid="handle">
            <span data-testid="grip" />
          </Resizable.Handle>
          <Resizable.Panel />
        </Resizable.Root>,
      );
      const handle = screen.getByTestId('handle');

      expect(handle.children).toHaveLength(2);
      expect(handle.firstElementChild).toBe(screen.getByTestId('grip'));
      expect(handle.lastElementChild).toHaveAttribute('data-vase-ui-resizable-hit-area');
      expect(handle.lastElementChild).not.toHaveAttribute('role');
      expect(handle.lastElementChild).toBeEmptyDOMElement();
    });

    it.each([
      { name: 'a horizontal root', orientation: 'horizontal' },
      { name: 'a vertical root', orientation: 'vertical' },
    ] as const)('is 10 px wide on the axis of the move, in $name', async ({ orientation }) => {
      const { area, rect } = await renderHandle(orientation);
      const areaRect = area.getBoundingClientRect();

      if (orientation === 'horizontal') {
        expect(area.style.width).toBe('max(100%, 10px)');
        expect([areaRect.width, areaRect.left, areaRect.height]).toEqual([
          10,
          rect.left - 1,
          rect.height,
        ]);
      } else {
        expect(area.style.height).toBe('max(100%, 10px)');
        expect([areaRect.height, areaRect.top, areaRect.width]).toEqual([
          10,
          rect.top - 1,
          rect.width,
        ]);
      }
    });

    it.each([
      { name: 'a number', size: 16, expected: 16 },
      { name: 'an object, for a fine pointer', size: { fine: 12, coarse: 30 }, expected: 12 },
      { name: 'the size 0', size: 0, expected: 8 },
    ])('has the size of $name', async ({ size, expected }) => {
      const { area } = await renderHandle('horizontal', { hitAreaSize: size });

      expect(area.getBoundingClientRect().width).toBe(expected);
    });

    it('keeps the box of the handle when the handle is wider than the size', async () => {
      const { area } = await renderHandle(
        'horizontal',
        {},
        { style: { flex: 'none', width: '20px' } },
      );

      expect(area.getBoundingClientRect().width).toBe(20);
    });

    it('has the coarse size while the pointer of the device is coarse', async () => {
      matchCoarsePointer();

      const { area } = await renderHandle('horizontal', { hitAreaSize: { fine: 12, coarse: 30 } });

      expect(area.style.width).toBe('max(100%, 30px)');
    });

    it('has the fine size for a number, also while the pointer is coarse', async () => {
      matchCoarsePointer();

      const { area } = await renderHandle('horizontal', { hitAreaSize: 14 });

      expect(area.style.width).toBe('max(100%, 14px)');
    });

    it('gives `position: relative` to the handle, and the style of the consumer wins', async () => {
      const { element } = await renderHandle();
      expect(element.style.position).toBe('relative');

      await renderPanels({ handle: { style: { position: 'absolute' } } });

      expect(screen.getAllByTestId('handle-1')[1]?.style.position).toBe('absolute');
    });

    it.each([
      { name: 'a mouse', pointerType: 'mouse' },
      { name: 'a touch', pointerType: 'touch' },
      { name: 'a pen', pointerType: 'pen' },
    ])(
      'starts the drag and gets the focus with a press of $name on the node',
      async ({ pointerType }) => {
        const { element, area } = await renderHandle();

        await fireEvent.pointerDown(area, pointerInit({ buttons: 1, pointerType }));

        expect(element).toHaveAttribute('data-dragging');
        expect(element).toHaveFocus();
      },
    );

    it('gives the `children` slot prop to the #render slot', async () => {
      await render(
        <Resizable.Root>
          <Resizable.Panel />
          <Resizable.Handle
            data-testid="handle"
            v-slots={{
              render: ({ props, children: Children }: any) => (
                <section {...props}>
                  <Children />
                </section>
              ),
            }}
          />
          <Resizable.Panel />
        </Resizable.Root>,
      );

      expect(screen.getByTestId('handle').tagName).toBe('SECTION');
      expect(screen.getByTestId('handle').lastElementChild).toHaveAttribute(
        'data-vase-ui-resizable-hit-area',
      );
    });

    describe('a handle that cannot move', () => {
      it.each([
        { name: 'a disabled handle', handle: { disabled: true } },
        { name: 'a disabled root', root: { disabled: true } },
      ])('takes no press beside it: $name', async ({ handle, root }) => {
        const { area } = await renderHandle('horizontal', root, handle);

        expect(area.style.pointerEvents).toBe('none');
      });

      it('takes no press beside a handle that has no panel on one side', async () => {
        await render(
          <Resizable.Root>
            <Resizable.Handle data-testid="handle" />
            <Resizable.Panel />
            <Resizable.Panel />
          </Resizable.Root>,
        );

        expect(screen.getByTestId('handle').lastElementChild).toHaveStyle({
          pointerEvents: 'none',
        });
      });

      it('takes a press beside a handle that has a disabled panel on one side', async () => {
        await renderPanels({ panels: [{ id: 'a', disabled: true }, { id: 'b' }] });
        const handle = screen.getByTestId('handle-1');

        expect(handle).toHaveAttribute('data-at-min');
        expect(handle).toHaveAttribute('data-at-max');
        expect(handle.lastElementChild).toHaveStyle({ pointerEvents: 'auto' });
      });

      it('takes a press when the handle can move, and when it becomes able to move', async () => {
        const disabled = shallowRef(true);
        await render(() => (
          <div style={{ width: '400px' }}>
            <Resizable.Root>
              <Resizable.Panel />
              <Resizable.Handle data-testid="handle" disabled={disabled.value} />
              <Resizable.Panel />
            </Resizable.Root>
          </div>
        ));
        const area = screen.getByTestId('handle').lastElementChild as HTMLElement;
        expect(area.style.pointerEvents).toBe('none');

        disabled.value = false;
        await nextTick();

        expect(area.style.pointerEvents).toBe('');
      });
    });
  });

  describe('crossing', () => {
    const outerLayout = { height: '100%' };

    // The outer root is 408 px wide and has a handle of 8 px, so 1% of its panel space is 4 px. The
    // inner root is 308 px high and has a handle of 8 px, so 1% of its panel space is 3 px.
    async function renderCrossing(
      options: {
        outer?: Record<string, unknown>;
        inner?: Record<string, unknown>;
        innerHandle?: Record<string, unknown>;
        showInnerHandle?: { value: boolean };
        outerDisabled?: { value: boolean };
        outerHandle?: Record<string, unknown>;
        renderOuterHandle?: InstanceType<typeof Resizable.Handle>['$slots']['render'];
        bottomPanel?: boolean;
      } = {},
    ) {
      await render(() => (
        <div style={{ width: '408px', height: '308px' }}>
          <Resizable.Root data-testid="outer" style={outerLayout} {...options.outer}>
            <Resizable.Panel id="left" />
            <Resizable.Handle
              data-testid="outer-handle"
              style={{ flex: 'none', width: '8px' }}
              disabled={options.outerDisabled?.value}
              {...options.outerHandle}
              v-slots={
                options.renderOuterHandle ? { render: options.renderOuterHandle } : undefined
              }
            />
            <Resizable.Panel id="right">
              <Resizable.Root
                data-testid="inner"
                orientation="vertical"
                style={outerLayout}
                {...options.inner}
              >
                <Resizable.Panel id="top" />
                {options.showInnerHandle?.value === false ? null : (
                  <Resizable.Handle
                    data-testid="inner-handle"
                    style={{ flex: 'none', height: '8px' }}
                    {...options.innerHandle}
                  />
                )}
                {options.bottomPanel === false ? null : <Resizable.Panel id="bottom" />}
              </Resizable.Root>
            </Resizable.Panel>
          </Resizable.Root>
        </div>
      ));
      const outer = screen.getByTestId('outer-handle');
      const inner = screen.queryByTestId('inner-handle') ?? outer;
      const outerRect = outer.getBoundingClientRect();
      const innerRect = inner.getBoundingClientRect();
      // The crossing is at the right border of the outer handle, at the middle of the inner handle.
      const at = { clientX: outerRect.right - 2, clientY: innerRect.top + innerRect.height / 2 };
      const move = (x: number, y: number, init: PointerEventInit = {}) =>
        fireEvent.pointerMove(
          outer,
          pointerInit({ clientX: at.clientX + x, clientY: at.clientY + y, buttons: 1, ...init }),
        );
      return { outer, inner, at, move };
    }

    const values = () => [
      screen.getByTestId('outer-handle').getAttribute('aria-valuenow'),
      screen.queryByTestId('inner-handle')?.getAttribute('aria-valuenow'),
    ];

    it('moves both layouts by the two distances of the pointer', async () => {
      const { outer, at, move } = await renderCrossing();

      await fireEvent.pointerDown(outer, pointerInit({ ...at, buttons: 1 }));
      await move(40, 30);

      expect(values()).toEqual(['60', '60']);
    });

    it('emits the events of each root one time', async () => {
      const outerEvents = { onDraggingChange: vi.fn(), onLayoutCommitted: vi.fn() };
      const innerEvents = { onDraggingChange: vi.fn(), onLayoutCommitted: vi.fn() };
      const { outer, at, move } = await renderCrossing({ outer: outerEvents, inner: innerEvents });

      await fireEvent.pointerDown(outer, pointerInit({ ...at, buttons: 1 }));
      await move(40, 30);
      await move(80, 60);
      await fireEvent.pointerUp(
        outer,
        pointerInit({ clientX: at.clientX + 80, clientY: at.clientY + 60 }),
      );

      for (const events of [outerEvents, innerEvents]) {
        expect(events.onDraggingChange.mock.calls).toEqual([[true], [false]]);
        expect(events.onLayoutCommitted).toHaveBeenCalledTimes(1);
      }
      expect(values()).toEqual(['70', '70']);
    });

    it('has data-dragging and data-crossing on both handles during the drag, and neither after it', async () => {
      const { outer, inner, at, move } = await renderCrossing();

      await fireEvent.pointerDown(outer, pointerInit({ ...at, buttons: 1 }));
      await move(10, 10);
      for (const handle of [outer, inner]) {
        expect(handle).toHaveAttribute('data-dragging');
        expect(handle).toHaveAttribute('data-crossing');
      }
      await fireEvent.pointerUp(
        outer,
        pointerInit({ clientX: at.clientX + 10, clientY: at.clientY + 10 }),
      );

      for (const handle of [outer, inner]) {
        expect(handle).not.toHaveAttribute('data-dragging');
        expect(handle).not.toHaveAttribute('data-crossing');
      }
    });

    it('gives data-crossing to the state of the handle', async () => {
      const { outer, at } = await renderCrossing({
        renderOuterHandle: ({ props, state, children }) => (
          <div {...props} class={`crossing-${String(state.crossing)}`}>
            {h(children)}
          </div>
        ),
      });
      expect(outer).toHaveClass('crossing-false');

      await fireEvent.pointerDown(outer, pointerInit({ ...at, buttons: 1 }));

      expect(outer).toHaveClass('crossing-true');
    });

    it('sets data-crossing on the handle under a pointer with no button at the crossing, and clears it at the leave', async () => {
      const { outer, inner, at } = await renderCrossing();

      await fireEvent.pointerMove(outer, pointerInit({ ...at, buttons: 0 }));
      expect(outer).toHaveAttribute('data-crossing');
      expect(inner).not.toHaveAttribute('data-crossing');
      await fireEvent.pointerLeave(outer, pointerInit({}));
      expect(outer).not.toHaveAttribute('data-crossing');

      await fireEvent.pointerMove(inner, pointerInit({ ...at, buttons: 0 }));
      expect(inner).toHaveAttribute('data-crossing');
    });

    it('keeps data-crossing on the joined handle while a second pointer presses it, moves on it and leaves it', async () => {
      const { outer, inner, at, move } = await renderCrossing();
      await fireEvent.pointerDown(outer, pointerInit({ ...at, buttons: 1 }));
      await move(10, 10);
      const second = (init: PointerEventInit = {}) =>
        pointerInit({
          pointerId: 2,
          pointerType: 'touch',
          clientX: at.clientX + 100,
          clientY: at.clientY + 10,
          ...init,
        });

      await fireEvent.pointerDown(inner, second({ buttons: 1 }));
      await fireEvent.pointerMove(inner, second({ clientX: at.clientX + 120, buttons: 1 }));
      expect(inner).toHaveAttribute('data-crossing');
      await fireEvent.pointerUp(inner, second());
      await fireEvent.pointerLeave(inner, second());

      expect(inner).toHaveAttribute('data-crossing');
      expect(inner).toHaveAttribute('data-dragging');
    });

    it('sets no data-crossing away from the crossing', async () => {
      const { outer, at } = await renderCrossing();

      await fireEvent.pointerMove(
        outer,
        pointerInit({ clientX: at.clientX, clientY: at.clientY - 60, buttons: 0 }),
      );

      expect(outer).not.toHaveAttribute('data-crossing');
    });

    it('does not drag the other handle with a press away from the crossing', async () => {
      const { outer, at, move } = await renderCrossing();

      await fireEvent.pointerDown(
        outer,
        pointerInit({ clientX: at.clientX, clientY: at.clientY - 60, buttons: 1 }),
      );
      await move(40, 30);

      expect(values()).toEqual(['60', '50']);
      expect(outer).not.toHaveAttribute('data-crossing');
    });

    it('clears the crossing under the pointer when the hovered handle becomes disabled', async () => {
      const outerDisabled = shallowRef(false);
      const { outer, at } = await renderCrossing({ outerDisabled });
      await fireEvent.pointerMove(outer, pointerInit({ ...at, buttons: 0 }));
      expect(outer).toHaveAttribute('data-crossing');

      outerDisabled.value = true;
      await nextTick();
      expect(outer).not.toHaveAttribute('data-crossing');
      await fireEvent.pointerMove(outer, pointerInit({ ...at, buttons: 0 }));
      expect(outer).not.toHaveAttribute('data-crossing');
    });

    it('does not join a disabled handle', async () => {
      const { outer, at, move } = await renderCrossing({ innerHandle: { disabled: true } });

      await fireEvent.pointerDown(outer, pointerInit({ ...at, buttons: 1 }));
      await move(40, 30);

      expect(screen.getByTestId('inner-handle')).not.toHaveAttribute('data-dragging');
      expect(outer).not.toHaveAttribute('data-crossing');
      expect(values()[0]).toBe('60');
    });

    it('does not join a handle that has no panel on one side, also for a pointer with no button', async () => {
      const { outer, at, move } = await renderCrossing({ bottomPanel: false });

      await fireEvent.pointerMove(outer, pointerInit({ ...at, buttons: 0 }));
      expect(outer).not.toHaveAttribute('data-crossing');
      await fireEvent.pointerDown(outer, pointerInit({ ...at, buttons: 1 }));
      await move(40, 30);

      expect(outer).not.toHaveAttribute('data-crossing');
      expect(outer).toHaveAttribute('aria-valuenow', '60');
    });

    it('does not join a root that has a drag already, and the drag of the outer root goes on', async () => {
      const { outer, inner, at, move } = await renderCrossing();
      await fireEvent.pointerDown(
        inner,
        pointerInit({ pointerId: 2, buttons: 1, clientX: at.clientX + 100, clientY: at.clientY }),
      );

      await fireEvent.pointerDown(outer, pointerInit({ ...at, buttons: 1 }));
      await move(40, 30);

      expect(outer).toHaveAttribute('data-dragging');
      expect(outer).not.toHaveAttribute('data-crossing');
      expect(inner).toHaveAttribute('data-dragging');
      expect(values()).toEqual(['60', '50']);
    });

    it('ends only its own drag when the joined handle unmounts, and the outer drag goes on', async () => {
      const showInnerHandle = shallowRef(true);
      const innerEvents = { onDraggingChange: vi.fn() };
      const { outer, at, move } = await renderCrossing({ showInnerHandle, inner: innerEvents });
      await fireEvent.pointerDown(outer, pointerInit({ ...at, buttons: 1 }));
      expect(innerEvents.onDraggingChange.mock.calls).toEqual([[true]]);

      showInnerHandle.value = false;
      await nextTick();
      await move(40, 30);

      expect(innerEvents.onDraggingChange.mock.calls).toEqual([[true], [false]]);
      expect(outer).toHaveAttribute('data-dragging');
      expect(outer.getAttribute('aria-valuenow')).toBe('60');
    });

    it('keeps a new pointer independent after its handle leaves a crossing', async () => {
      const disabled = shallowRef(false);
      const { outer, inner, at, move } = await renderCrossing({
        innerHandle: {
          get disabled() {
            return disabled.value;
          },
        },
      });
      await fireEvent.pointerDown(outer, pointerInit({ ...at, buttons: 1 }));
      expect(inner).toHaveAttribute('data-crossing');

      disabled.value = true;
      await nextTick();
      disabled.value = false;
      await nextTick();
      const second = { pointerId: 2, clientX: at.clientX + 100, clientY: at.clientY, buttons: 1 };
      await fireEvent.pointerDown(inner, pointerInit(second));
      await move(40, 30);
      expect(values()).toEqual(['60', '50']);
      expect(outer).not.toHaveAttribute('data-crossing');
      await fireEvent.pointerUp(outer, pointerInit(at));
      expect(inner).toHaveAttribute('data-dragging');

      await fireEvent.pointerMove(inner, pointerInit({ ...second, clientY: at.clientY + 60 }));
      expect(values()).toEqual(['60', '70']);
      await fireEvent.pointerUp(inner, pointerInit({ ...second, buttons: 0 }));
      expect(inner).not.toHaveAttribute('data-dragging');
    });

    it('ends both drags when the pressed handle becomes disabled', async () => {
      const outerDisabled = shallowRef(false);
      const outerEvents = { onDraggingChange: vi.fn() };
      const innerEvents = { onDraggingChange: vi.fn() };
      const { outer, inner, at } = await renderCrossing({
        outer: outerEvents,
        inner: innerEvents,
        outerDisabled,
      });
      await fireEvent.pointerDown(outer, pointerInit({ ...at, buttons: 1 }));
      expect(inner).toHaveAttribute('data-dragging');

      outerDisabled.value = true;
      await nextTick();

      for (const handle of [outer, inner]) {
        expect(handle).not.toHaveAttribute('data-dragging');
        expect(handle).not.toHaveAttribute('data-crossing');
      }
      for (const events of [outerEvents, innerEvents]) {
        expect(events.onDraggingChange.mock.calls).toEqual([[true], [false]]);
      }
    });

    it('lets the click of the joined handle go on, and stops the click of the pressed handle', async () => {
      const onInnerClick = vi.fn();
      const onOuterClick = vi.fn();
      const { outer, inner, at, move } = await renderCrossing({
        innerHandle: { onClick: onInnerClick },
        outerHandle: { onClick: onOuterClick },
      });

      await fireEvent.pointerDown(outer, pointerInit({ ...at, buttons: 1 }));
      await move(40, 30);
      await fireEvent.pointerUp(
        outer,
        pointerInit({ clientX: at.clientX + 40, clientY: at.clientY + 30 }),
      );
      await fireEvent.click(inner, { detail: 1 });
      await fireEvent.click(outer, { detail: 1 });

      expect(onInnerClick).toHaveBeenCalledTimes(1);
      expect(onOuterClick).not.toHaveBeenCalled();
    });
  });

  describe('resize mode on-release', () => {
    const onRelease = { resizeMode: 'on-release' };

    it.each([
      {
        name: 'a horizontal root',
        orientation: 'horizontal',
        direction: 'ltr',
        to: 100,
        expected: '100px',
      },
      {
        name: 'a vertical root',
        orientation: 'vertical',
        direction: 'ltr',
        to: 80,
        expected: '80px',
      },
      {
        name: 'a right-to-left root',
        orientation: 'horizontal',
        direction: 'rtl',
        to: 100,
        expected: '100px',
      },
      {
        name: 'a pointer that goes back',
        orientation: 'horizontal',
        direction: 'ltr',
        to: -100,
        expected: '-100px',
      },
    ] as const)(
      'shows the distance to the place of the release in $name',
      async ({ orientation, direction, to, expected }) => {
        await renderPanels({ root: { ...onRelease, orientation }, direction });
        const handle = screen.getByTestId('handle-1');

        await fireEvent.pointerDown(handle, pointerInit({ buttons: 1 }));
        expect(preview(handle)).toBe('0px');
        await fireEvent.pointerMove(
          handle,
          pointerInit({
            ...(orientation === 'horizontal' ? { clientX: to } : { clientY: to }),
            buttons: 1,
          }),
        );

        expect(preview(handle)).toBe(expected);
        expect(handle).toHaveAttribute('aria-valuenow', '50');
      },
    );

    it('gives the distance with three decimals at most', async () => {
      // 10 px of a root of 300 px is 10/3 percent, and a number has no exact value for it.
      await render(
        <div style={{ width: '300px' }}>
          <Resizable.Root resizeMode="on-release">
            <Resizable.Panel />
            <Resizable.Handle data-testid="handle" />
            <Resizable.Panel />
          </Resizable.Root>
        </div>,
      );
      const handle = screen.getByTestId('handle');

      await fireEvent.pointerDown(handle, pointerInit({ buttons: 1 }));
      await fireEvent.pointerMove(handle, pointerInit({ clientX: 10, buttons: 1 }));

      expect(preview(handle)).toMatch(/^\d+(\.\d{1,3})?px$/);
      expect(Number.parseFloat(preview(handle))).toBeCloseTo(10, 2);
    });

    it('stops the distance at a constraint of the layout', async () => {
      await renderPanels({ root: onRelease, panels: [{ id: 'a' }, { id: 'b', minSize: 40 }] });
      const handle = screen.getByTestId('handle-1');

      await fireEvent.pointerDown(handle, pointerInit({ buttons: 1 }));
      await fireEvent.pointerMove(handle, pointerInit({ clientX: 500, buttons: 1 }));

      expect(preview(handle)).toBe('100px');
    });

    it('has no variable before the press, after the release and after a cancel', async () => {
      await renderPanels({ root: onRelease });
      const handle = screen.getByTestId('handle-1');
      expect(preview(handle)).toBe('');

      await drag(handle, 0, 100);
      expect(preview(handle)).toBe('');

      await fireEvent.pointerDown(handle, pointerInit({ buttons: 1 }));
      await fireEvent.pointerMove(handle, pointerInit({ clientX: 100, buttons: 1 }));
      await fireEvent.pointerCancel(handle, pointerInit({}));
      expect(preview(handle)).toBe('');
      expect(handle).toHaveAttribute('aria-valuenow', '60');
    });

    it('keeps the layout during the drag and writes it at the release', async () => {
      await renderPanels({ root: onRelease });
      const handle = screen.getByTestId('handle-1');
      const before = sizeOf(0);

      await fireEvent.pointerDown(handle, pointerInit({ buttons: 1 }));
      await fireEvent.pointerMove(handle, pointerInit({ clientX: 100, buttons: 1 }));
      expect(sizeOf(0)).toBe(before);
      await fireEvent.pointerUp(handle, pointerInit({ clientX: 100 }));

      expect(sizeOf(0)).toBeCloseTo(before + 100, 0);
    });

    it('gives a handle that the layout moves its own distance and no data-dragging', async () => {
      await renderPanels({
        root: { ...onRelease, defaultLayout: { a: 40, b: 30, c: 30 } },
        panels: [{ id: 'a' }, { id: 'b', minSize: 20 }, { id: 'c', minSize: 10 }],
      });
      const first = screen.getByTestId('handle-1');
      const second = screen.getByTestId('handle-2');

      await fireEvent.pointerDown(first, pointerInit({ buttons: 1 }));
      expect(preview(second)).toBe('');
      await fireEvent.pointerMove(first, pointerInit({ clientX: 250, buttons: 1 }));

      expect(preview(first)).toBe('250px');
      expect(preview(second)).toBe('150px');
      expect(second).not.toHaveAttribute('data-dragging');
    });

    it('gives no variable to a handle that does not move', async () => {
      await renderPanels({
        root: { ...onRelease, defaultLayout: { a: 40, b: 30, c: 30 } },
        panels: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      });
      const first = screen.getByTestId('handle-1');

      await fireEvent.pointerDown(screen.getByTestId('handle-2'), pointerInit({ buttons: 1 }));
      await fireEvent.pointerMove(
        screen.getByTestId('handle-2'),
        pointerInit({ clientX: 100, buttons: 1 }),
      );

      expect(preview(first)).toBe('');
    });

    it.each([
      { name: 'a touch', pointerType: 'touch' },
      { name: 'a pen', pointerType: 'pen' },
    ])('shows the distance for $name', async ({ pointerType }) => {
      await renderPanels({ root: onRelease });
      const handle = screen.getByTestId('handle-1');

      await fireEvent.pointerDown(handle, pointerInit({ buttons: 1, pointerType }));
      await fireEvent.pointerMove(handle, pointerInit({ clientX: 100, buttons: 1, pointerType }));

      expect(preview(handle)).toBe('100px');
    });
  });

  describe('click after a drag', () => {
    // The click of a press has the detail 1 or more, and `element.click()` has 0.
    const clickOfPress = (handle: HTMLElement) => fireEvent.click(handle, { detail: 1 });

    it.each([
      { name: 'a mouse', pointerType: 'mouse' },
      { name: 'a touch', pointerType: 'touch' },
      { name: 'a pen', pointerType: 'pen' },
    ])(
      'stops the click that follows a drag of $name in which the pointer moved',
      async ({ pointerType }) => {
        const onClick = vi.fn();
        await renderPanels({ handle: { onClick } });
        const handle = screen.getByTestId('handle-1');

        await drag(handle, 0, 100, { pointerType });

        expect(await clickOfPress(handle)).toBe(false);
        expect(onClick).not.toHaveBeenCalled();
      },
    );

    it('lets the click that follows a press with no move go on', async () => {
      const onClick = vi.fn();
      await renderPanels({ handle: { onClick } });
      const handle = screen.getByTestId('handle-1');

      await drag(handle, 0, 0);

      expect(await clickOfPress(handle)).toBe(true);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('stops one click only', async () => {
      const onClick = vi.fn();
      await renderPanels({ handle: { onClick } });
      const handle = screen.getByTestId('handle-1');

      await drag(handle, 0, 100);
      await clickOfPress(handle);
      await clickOfPress(handle);

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it.each([
      {
        name: 'a press with no move',
        press: (handle: HTMLElement) => drag(handle, 5, 5),
      },
      {
        name: 'a press that starts no drag',
        press: (handle: HTMLElement) =>
          fireEvent.pointerDown(handle, pointerInit({ button: 2, buttons: 2 })),
      },
    ])('clears the rule with $name', async ({ press }) => {
      const onClick = vi.fn();
      await renderPanels({ handle: { onClick } });
      const handle = screen.getByTestId('handle-1');
      await drag(handle, 0, 100);

      await press(handle);
      await clickOfPress(handle);

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    // No click follows a touch drag in Chromium, so the rule is still set when a script clicks.
    it('lets a click that a script makes go on after a drag that no click followed', async () => {
      const onClick = vi.fn();
      await renderPanels({ handle: { onClick } });
      const handle = screen.getByTestId('handle-1');

      await drag(handle, 0, 100, { pointerType: 'touch' });
      handle.click();
      await nextTick();

      expect(onClick).toHaveBeenCalledTimes(1);
      // The click of the script cleared the rule, so the next click with a detail goes on too.
      await clickOfPress(handle);
      expect(onClick).toHaveBeenCalledTimes(2);
    });
  });

  describe('state', () => {
    it('gives the orientation, disabled state and drag state to the default slot', async () => {
      await render(
        <Resizable.Root orientation="vertical">
          <Resizable.Panel />
          <Resizable.Handle data-testid="handle">
            {{
              default: ({ state }: { state: Resizable.Handle.State }) => (
                <span class={`${state.orientation}-${state.disabled}-${state.dragging}`}>
                  {state.orientation}
                </span>
              ),
            }}
          </Resizable.Handle>
          <Resizable.Panel />
        </Resizable.Root>,
      );
      const handle = screen.getByTestId('handle');

      expect(handle).toHaveTextContent('vertical');
      expect(handle.querySelector('span')).toHaveClass('vertical-false-false');
    });
  });

  describe('hydration', () => {
    removedPartHydrationTests({
      file: 'src/resizable/root/ResizableRootHydration.test.vue',
      component: ResizableRootHydration,
      cases: [
        {
          name: 'a removed panel, aria-controls',
          props: { composition: 'layout', laterRemovedAtMount: true },
          selector: '[data-testid="handle-a"]',
          attribute: 'aria-controls',
          serverValue: 'a',
          clientValue: null,
        },
        {
          name: 'a removed panel, aria-valuenow',
          props: { composition: 'layout', laterRemovedAtMount: true },
          selector: '[data-testid="handle-a"]',
          attribute: 'aria-valuenow',
          serverValue: '20',
          clientValue: null,
        },
        {
          name: 'a removed panel, aria-valuemin',
          props: { composition: 'layout', laterRemovedAtMount: true },
          selector: '[data-testid="handle-a"]',
          attribute: 'aria-valuemin',
          serverValue: '0',
          clientValue: null,
        },
        {
          name: 'a removed panel, aria-valuemax',
          props: { composition: 'layout', laterRemovedAtMount: true },
          selector: '[data-testid="handle-a"]',
          attribute: 'aria-valuemax',
          serverValue: '100',
          clientValue: null,
        },
        {
          name: 'a removed panel, aria-valuetext',
          props: { composition: 'layout', laterRemovedAtMount: true },
          selector: '[data-testid="handle-a"]',
          attribute: 'aria-valuetext',
          serverValue: 'Quarter',
          clientValue: null,
        },
        {
          name: 'a removed panel, data-at-min',
          props: { composition: 'removedLast', laterRemovedAtMount: true },
          selector: '[data-testid="handle-a"]',
          attribute: 'data-at-min',
          serverValue: '',
          clientValue: null,
        },
        {
          name: 'a stored layout, data-at-min',
          props: { composition: 'stored' },
          selector: '[data-testid="handle-a"]',
          attribute: 'data-at-min',
          serverValue: '',
          clientValue: null,
        },
        {
          name: 'a render slot, data-at-max',
          props: { composition: 'stored' },
          selector: '[data-testid="handle-b"]',
          attribute: 'data-at-max',
          serverValue: '',
          clientValue: null,
        },
      ],
    });

    it('gives the drag limit of the server HTML to the render slot while it hydrates', async () => {
      const props = { composition: 'slotStyles' };
      const serverHtml = await renderOnServer(
        'src/resizable/root/ResizableRootHydration.test.vue',
        props,
      );

      const { container } = await hydrate(ResizableRootHydration, { serverHtml, props });

      const handle = container.querySelector('[data-testid="handle-a"]');
      expect(handle).toHaveClass('at-min');
      expect(handle).toHaveStyle({ opacity: '0.5' });
    });
  });

  describe('prop: getAriaValueText', () => {
    // After the mount, the text has the locale of the page.
    const percent = (value: number) =>
      new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 }).format(
        value / 100,
      );

    it('gives the formatted percent, the value and the pixels after a drag', async () => {
      const getAriaValueText = vi.fn(
        (text: string, value: number, details: { pixelSize: number | undefined }) =>
          `${text} ${value} ${String(details.pixelSize)}`,
      );
      await renderPanels({ handle: { getAriaValueText } });
      const handle = screen.getByTestId('handle-1');

      await drag(handle, 0, 100);

      expect(getAriaValueText).toHaveBeenLastCalledWith(percent(60), 60, {
        collapsed: false,
        pixelSize: 600,
      });
      expect(handle).toHaveAttribute('aria-valuetext', `${percent(60)} 60 600`);
    });

    it('gives collapsed true after a collapse with Enter', async () => {
      const getAriaValueText = vi.fn(() => 'Text');
      await renderPanels({
        handle: { getAriaValueText },
        panels: [{ id: 'a', collapsible: true, collapsedSize: 5, minSize: 20 }, { id: 'b' }],
      });
      const handle = screen.getByTestId('handle-1');
      handle.focus();

      await fireEvent.keyDown(handle, { key: 'Enter' });

      expect(handle).toHaveAttribute('aria-valuenow', '5');
      expect(getAriaValueText).toHaveBeenLastCalledWith(percent(5), 5, {
        collapsed: true,
        pixelSize: 50,
      });
    });

    it('gives the text of the function over ariaValuetext', async () => {
      await renderPanels({
        handle: { ariaValuetext: 'Half', getAriaValueText: () => 'From the function' },
      });

      expect(screen.getByTestId('handle-1')).toHaveAttribute('aria-valuetext', 'From the function');
    });

    it('renders ariaValuetext with no function', async () => {
      await renderPanels({ handle: { ariaValuetext: 'Half' } });

      expect(screen.getByTestId('handle-1')).toHaveAttribute('aria-valuetext', 'Half');
    });

    it('renders no aria-valuetext with neither', async () => {
      await renderPanels();
      const handle = screen.getByTestId('handle-1');

      expect(handle).toHaveAttribute('aria-valuenow', '50');
      expect(handle).not.toHaveAttribute('aria-valuetext');
    });

    it('renders no aria-valuetext on a disabled handle', async () => {
      await renderPanels({ handle: { disabled: true, ariaValuetext: 'Half' } });
      const handle = screen.getByTestId('handle-1');

      expect(handle).toHaveAttribute('aria-disabled', 'true');
      expect(handle).not.toHaveAttribute('aria-valuenow');
      expect(handle).not.toHaveAttribute('aria-valuetext');
    });

    it('renders no aria-valuetext on a handle with no panel after it', async () => {
      await render(
        <div style={{ width: '1000px' }}>
          <Resizable.Root>
            <Resizable.Panel id="a" />
            <Resizable.Handle data-testid="handle" ariaValuetext="Half" />
          </Resizable.Root>
        </div>,
      );
      const handle = screen.getByTestId('handle');

      expect(handle).not.toHaveAttribute('tabindex');
      expect(handle).not.toHaveAttribute('aria-valuetext');
    });
  });
});
