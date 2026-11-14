import { describe, expect, it, vi } from 'vitest';
import { nextTick, shallowRef } from 'vue';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import {
  createRenderer,
  describeConformance,
  expectNoAxeViolations,
  fireEvent,
  screen,
} from '#test-utils';
import * as Resizable from '../index.parts';

describe('<Resizable.Handle />', () => {
  const { render } = createRenderer();

  interface PanelsOptions {
    root?: Record<string, unknown>;
    panels?: Record<string, unknown>[];
    handle?: Record<string, unknown>;
    direction?: 'ltr' | 'rtl';
  }

  // The container is 1000 px wide and 400 px high, and a handle has no size, so 1% of the panel
  // space is 10 px on a horizontal axis and 4 px on a vertical axis.
  function renderPanels({
    root,
    panels = [{ id: 'a' }, { id: 'b' }],
    handle,
    direction = 'ltr',
  }: PanelsOptions = {}) {
    return render(
      <DirectionProvider direction={direction}>
        <div dir={direction} style={{ width: '1000px', height: '400px' }}>
          <Resizable.Root data-testid="root" style={{ height: '100%' }} {...root}>
            {panels.flatMap((panel, index) => [
              index > 0 ? (
                <Resizable.Handle
                  key={`handle-${index}`}
                  data-testid={`handle-${index}`}
                  {...handle}
                />
              ) : null,
              <Resizable.Panel key={`panel-${index}`} data-testid={`panel-${index}`} {...panel} />,
            ])}
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

  describe('state', () => {
    it('gives the state to the slot and to stateClass', async () => {
      await render(
        <Resizable.Root orientation="vertical">
          <Resizable.Panel />
          <Resizable.Handle
            data-testid="handle"
            stateClass={(state) =>
              `${state.orientation}-${String(state.disabled)}-${String(state.dragging)}`
            }
          >
            {{ default: ({ state }: { state: { orientation: string } }) => state.orientation }}
          </Resizable.Handle>
          <Resizable.Panel />
        </Resizable.Root>,
      );
      const handle = screen.getByTestId('handle');

      expect(handle).toHaveTextContent('vertical');
      expect(handle).toHaveClass('vertical-false-false');
    });
  });
});
