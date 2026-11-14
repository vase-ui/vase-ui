import { expect, vi, describe, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { KeepAlive, nextTick, shallowRef } from 'vue';
import { NumberField } from '@vase-ui/vue/number-field';
import {
  createRenderer,
  describeConformance,
  fireTouch,
  flushMicrotasks,
  isJSDOM,
  pasteText,
  screen,
  wait,
} from '#test-utils';
import { platform } from '../../common/platform';

const isWebKit = platform.engine.webkit;

// The cases make their pointer events here, and not with `user.pointer()`.
// See https://github.com/testing-library/user-event/issues/903.
let currentPos = { clientX: 0, clientY: 0 };

function createPointerDownEvent(elm: HTMLElement) {
  const box = elm.getBoundingClientRect();
  const centerX = box.left + box.width / 2;
  const centerY = box.top + box.height / 2;
  currentPos = { clientX: centerX, clientY: centerY };
  return new PointerEvent('pointerdown', {
    bubbles: true,
    ...currentPos,
  });
}

// Firefox ends a scrub 20 ms after the `pointerup`, so the wait lets each engine end it.
async function releasePointer() {
  window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  await wait(20);
  await flushMicrotasks();
}

function createPointerMoveEvent({ movementX = 0, movementY = 0 }) {
  currentPos = {
    clientX: currentPos.clientX + movementX,
    clientY: currentPos.clientY + movementY,
  };
  return new PointerEvent('pointermove', {
    bubbles: true,
    ...currentPos,
    movementX,
    movementY,
  });
}

describe('<NumberField.ScrubArea />', () => {
  const { render } = createRenderer();

  describeConformance(<NumberField.ScrubArea />, () => ({
    refInstanceof: window.HTMLSpanElement,
    render: async (node) => {
      return render(<NumberField.Root>{node}</NumberField.Root>);
    },
  }));

  it('has presentation role', async () => {
    await render(
      <NumberField.Root>
        <NumberField.ScrubArea />
      </NumberField.Root>,
    );
    expect(screen.queryByRole('presentation')).not.toBe(null);
  });

  describe('touch input', () => {
    const touch = { clientX: 0, clientY: 0 };

    async function renderScrubArea() {
      await render(
        <NumberField.Root defaultValue={0}>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area" />
        </NumberField.Root>,
      );
      return { scrubArea: screen.getByTestId('scrub-area') };
    }

    it('blocks scrolling for a single-touch scrub', async () => {
      const { scrubArea } = await renderScrubArea();
      const notCanceled = await fireTouch.start(scrubArea, { touches: [touch] });
      expect(notCanceled).toBe(false);
    });

    it('leaves multi-touch gestures such as pinch-zoom to the browser', async () => {
      const { scrubArea } = await renderScrubArea();
      const notCanceled = await fireTouch.start(scrubArea, { touches: [touch, touch] });
      expect(notCanceled).toBe(true);
    });
  });

  describe('pointerdown guards', () => {
    async function renderScrubArea(props?: NumberField.Root.Props) {
      await render(
        <NumberField.Root defaultValue={0} data-testid="root" {...props}>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area">
            <NumberField.ScrubAreaCursor />
          </NumberField.ScrubArea>
        </NumberField.Root>,
      );
      return {
        scrubArea: screen.getByTestId('scrub-area'),
        root: screen.getByTestId('root'),
      };
    }

    it('ignores non-primary pointer buttons', async () => {
      const { scrubArea, root } = await renderScrubArea();

      scrubArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 1 }));
      await flushMicrotasks();

      expect(root).not.toHaveAttribute('data-scrubbing');
    });

    it('does not start scrubbing when the field is read-only', async () => {
      const { scrubArea, root } = await renderScrubArea({ readOnly: true });

      scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
      await flushMicrotasks();

      expect(root).not.toHaveAttribute('data-scrubbing');
    });

    it('keeps a selection the consumer sets in onFocus when a mouse press focuses the input', async () => {
      await render(
        <NumberField.Root defaultValue={100}>
          <NumberField.Input
            onFocusin={(event: FocusEvent) => (event.currentTarget as HTMLInputElement).select()}
          />
          <NumberField.ScrubArea data-testid="scrub-area" />
        </NumberField.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');

      screen
        .getByTestId('scrub-area')
        .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
      await flushMicrotasks();

      expect(input).toHaveFocus();
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(input.value.length);
    });
  });

  describe('KeepAlive', () => {
    it('VUE-53: ends the scrub with no commit when KeepAlive deactivates the scrub area', async () => {
      const onValueCommitted = vi.fn();
      const visible = shallowRef(true);

      await render(() => (
        <KeepAlive>
          {visible.value ? (
            <NumberField.Root
              defaultValue={0}
              data-testid="root"
              onValueCommitted={onValueCommitted}
            >
              <NumberField.Input />
              <NumberField.ScrubArea data-testid="scrub-area" />
            </NumberField.Root>
          ) : null}
        </KeepAlive>
      ));

      const scrubArea = screen.getByTestId('scrub-area');
      scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
      await flushMicrotasks();
      expect(screen.getByTestId('root')).toHaveAttribute('data-scrubbing');

      visible.value = false;
      await flushMicrotasks();
      visible.value = true;
      await flushMicrotasks();

      expect(screen.getByTestId('root')).not.toHaveAttribute('data-scrubbing');

      await releasePointer();

      expect(onValueCommitted).not.toHaveBeenCalled();
    });

    it('does not click a scrub area that KeepAlive deactivates after the release', async () => {
      const handleClick = vi.fn();
      const visible = shallowRef(true);

      await render(() => (
        <KeepAlive>
          {visible.value ? (
            <NumberField.Root defaultValue={0}>
              <NumberField.Input />
              <NumberField.ScrubArea data-testid="scrub-area" onClick={handleClick} />
            </NumberField.Root>
          ) : null}
        </KeepAlive>
      ));

      const scrubArea = screen.getByTestId('scrub-area');
      scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
      await flushMicrotasks();

      // The deactivation comes in the task of the release, before the timer of the click.
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      visible.value = false;
      await nextTick();
      await wait(50);

      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  // Only run the following tests in Chromium/Firefox.
  if (isJSDOM || isWebKit) {
    return;
  }

  it('should increment or decrement the value when scrubbing with the pointer', async () => {
    await render(
      <NumberField.Root defaultValue={0}>
        <NumberField.Input />
        <NumberField.ScrubArea data-testid="scrub-area">
          <NumberField.ScrubAreaCursor />
        </NumberField.ScrubArea>
      </NumberField.Root>,
    );

    const scrubArea = screen.getByTestId('scrub-area');
    const input = screen.getByRole('textbox');

    scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
    scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: -10 }));
    await flushMicrotasks();

    expect(input).toHaveValue('-10');
    scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 5 }));
    await flushMicrotasks();

    expect(input).toHaveValue('-5');

    scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: -2 }));
    await flushMicrotasks();

    expect(input).toHaveValue('-7');
  });

  it('places the cursor at the pointer before the pointer lock request resolves', async () => {
    const pointerLock = vi
      .spyOn(document.body, 'requestPointerLock')
      .mockImplementation(() => new Promise(() => {}));

    try {
      await render(
        <NumberField.Root defaultValue={0}>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area">
            <NumberField.ScrubAreaCursor data-testid="cursor" />
          </NumberField.ScrubArea>
        </NumberField.Root>,
      );

      screen
        .getByTestId('scrub-area')
        .dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, clientX: 30, clientY: 40 }),
        );
      await flushMicrotasks();

      expect(pointerLock).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('cursor').style.transform).toMatch(/^translate3d\(30px, ?40px,/);
    } finally {
      pointerLock.mockRestore();
    }
  });

  it('tracks visual viewport scale and removes scrub listeners after pointer lock exits', async () => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) {
      throw new Error('Expected visualViewport in a browser test.');
    }

    let scale = 2;
    const scaleGetter = vi.spyOn(visualViewport, 'scale', 'get').mockImplementation(() => scale);
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const removeEventListener = vi.spyOn(window, 'removeEventListener');
    const pointerLock = vi
      .spyOn(document.body, 'requestPointerLock')
      .mockImplementation(() => Promise.resolve());

    try {
      await render(
        <NumberField.Root defaultValue={0} data-testid="root">
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area">
            <NumberField.ScrubAreaCursor data-testid="cursor" />
          </NumberField.ScrubArea>
        </NumberField.Root>,
      );

      const scrubArea = screen.getByTestId('scrub-area');
      const root = screen.getByTestId('root');

      scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
      await flushMicrotasks();

      const cursor = screen.getByTestId('cursor');
      expect(cursor.style.transform).toContain('scale(0.5)');

      scale = 4;
      window.dispatchEvent(createPointerMoveEvent({ movementX: 4 }));
      await flushMicrotasks();
      expect(cursor.style.transform).toContain('scale(0.25)');

      const pointerUpListener = addEventListener.mock.calls.find(([type]) => type === 'pointerup');
      const pointerMoveListener = addEventListener.mock.calls.find(
        ([type]) => type === 'pointermove',
      );
      expect(pointerUpListener).toBeDefined();
      expect(pointerMoveListener).toBeDefined();

      await releasePointer();

      expect(root).not.toHaveAttribute('data-scrubbing');
      expect(screen.queryByTestId('cursor')).toBe(null);
      expect(removeEventListener).toHaveBeenCalledWith('pointerup', pointerUpListener?.[1], true);
      expect(removeEventListener).toHaveBeenCalledWith(
        'pointermove',
        pointerMoveListener?.[1],
        true,
      );
    } finally {
      scaleGetter.mockRestore();
      addEventListener.mockRestore();
      removeEventListener.mockRestore();
      pointerLock.mockRestore();
    }
  });

  it('clears the root scrubbing state when the scrub area unmounts mid-scrub', async () => {
    function App(props: { scrubAreaMounted: boolean }) {
      return (
        <NumberField.Root defaultValue={0} data-testid="root">
          <NumberField.Input />
          {props.scrubAreaMounted && (
            <NumberField.ScrubArea data-testid="scrub-area">
              <NumberField.ScrubAreaCursor />
            </NumberField.ScrubArea>
          )}
        </NumberField.Root>
      );
    }

    const { setProps } = await render(<App scrubAreaMounted />);

    const scrubArea = screen.getByTestId('scrub-area');
    const root = screen.getByTestId('root');

    scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
    scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: -10 }));
    await flushMicrotasks();

    expect(root).toHaveAttribute('data-scrubbing');

    // Unmount the scrub area before pointerup; the root must not stay stuck in the scrubbing state.
    await setProps({ scrubAreaMounted: false });
    await flushMicrotasks();

    expect(root).not.toHaveAttribute('data-scrubbing');
  });

  it('syncs the visible input value when scrubbing after pasting', async () => {
    const onValueChange = vi.fn();

    await render(
      <NumberField.Root defaultValue={10} onValueChange={onValueChange}>
        <NumberField.Input />
        <NumberField.ScrubArea data-testid="scrub-area">
          <NumberField.ScrubAreaCursor />
        </NumberField.ScrubArea>
      </NumberField.Root>,
    );

    const scrubArea = screen.getByTestId('scrub-area');
    const input = screen.getByRole('textbox') as HTMLInputElement;

    // Select the existing value so the paste replaces it rather than inserting at the caret.
    input.focus();
    await flushMicrotasks();
    input.select();
    await pasteText(input, '20');

    expect(input).toHaveValue('20');
    expect(onValueChange.mock.lastCall?.[0]).toBe(20);

    scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
    scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 2 }));
    await flushMicrotasks();

    expect(onValueChange.mock.lastCall?.[0]).toBe(22);
    expect(input).toHaveValue('22');
  });

  it('calls onValueChange while scrubbing and onValueCommitted on pointerup', async () => {
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();

    await render(
      <NumberField.Root
        defaultValue={0}
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
      >
        <NumberField.Input />
        <NumberField.ScrubArea data-testid="scrub-area">
          <NumberField.ScrubAreaCursor />
        </NumberField.ScrubArea>
      </NumberField.Root>,
    );

    const scrubArea = screen.getByTestId('scrub-area');

    scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
    scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 3 }));
    await flushMicrotasks();

    // One or more changes depending on pixel sensitivity and environment
    expect(onValueChange.mock.calls.length).toBeGreaterThan(0);

    await releasePointer();

    expect(onValueCommitted.mock.calls.length).toBe(1);

    const lastChange = onValueChange.mock.lastCall?.[0];
    const committed = onValueCommitted.mock.calls[0][0];
    expect(committed).toBe(lastChange);
  });

  // Gecko defers the pointer lock release by 20ms, so the scrub is still live right after
  // `pointerup` there; that path is covered by `NumberFieldScrubArea.gecko.test.tsx`.
  it.skipIf(platform.engine.gecko)(
    'ignores pointer movement once the scrub has ended',
    async () => {
      await render(
        <NumberField.Root defaultValue={0}>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area">
            <NumberField.ScrubAreaCursor />
          </NumberField.ScrubArea>
        </NumberField.Root>,
      );

      const scrubArea = screen.getByTestId('scrub-area');
      const input = screen.getByRole('textbox');

      scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
      scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 10 }));
      await flushMicrotasks();

      expect(input).toHaveValue('10');

      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      window.dispatchEvent(createPointerMoveEvent({ movementX: 10 }));
      await flushMicrotasks();

      expect(input).toHaveValue('10');
    },
  );

  describe('React.Activity', () => {
    it('does not resume scrubbing when a hidden scrub area is revealed again', async () => {
      const visible = shallowRef(true);

      await render(() => (
        <KeepAlive>
          {visible.value ? (
            <NumberField.Root defaultValue={0}>
              <NumberField.Input />
              <NumberField.ScrubArea data-testid="scrub-area">
                <NumberField.ScrubAreaCursor />
              </NumberField.ScrubArea>
            </NumberField.Root>
          ) : null}
        </KeepAlive>
      ));

      const scrubArea = screen.getByTestId('scrub-area');
      const input = screen.getByRole('textbox');

      scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
      scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 10 }));
      await flushMicrotasks();

      expect(input).toHaveValue('10');

      // Hiding tears the effects down mid-scrub without unmounting; revealing re-runs them.
      visible.value = false;
      await flushMicrotasks();
      visible.value = true;
      await flushMicrotasks();

      // No pointer is down anymore, so a bare mouse move must not change the value.
      window.dispatchEvent(createPointerMoveEvent({ movementX: 10 }));
      await flushMicrotasks();

      expect(screen.getByRole('textbox')).toHaveValue('10');
    });

    it('VUE-53: takes the cursor out of the document and ends the pointer lock when KeepAlive deactivates the scrub area', async () => {
      const visible = shallowRef(true);
      const pointerLock = vi
        .spyOn(document.body, 'requestPointerLock')
        .mockImplementation(() => Promise.resolve());
      const exitPointerLock = vi.spyOn(document, 'exitPointerLock').mockImplementation(() => {});

      try {
        await render(() => (
          <KeepAlive>
            {visible.value ? (
              <NumberField.Root defaultValue={0}>
                <NumberField.Input />
                <NumberField.ScrubArea data-testid="scrub-area">
                  <NumberField.ScrubAreaCursor data-testid="cursor" />
                </NumberField.ScrubArea>
              </NumberField.Root>
            ) : null}
          </KeepAlive>
        ));

        const scrubArea = screen.getByTestId('scrub-area');
        scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
        await flushMicrotasks();
        expect(screen.getByTestId('cursor')).not.toBe(null);
        expect(exitPointerLock).not.toHaveBeenCalled();

        visible.value = false;
        await flushMicrotasks();

        // `KeepAlive` takes the area out of the document, but not the teleported cursor.
        expect(screen.queryByTestId('cursor')).toBe(null);
        expect(exitPointerLock).toHaveBeenCalledTimes(1);

        visible.value = true;
        await flushMicrotasks();

        expect(screen.queryByTestId('cursor')).toBe(null);
      } finally {
        pointerLock.mockRestore();
        exitPointerLock.mockRestore();
      }
    });
  });

  describe('prop: pixelSensitivity', () => {
    it('does not change the value for a zero-distance move when sensitivity is 0', async () => {
      const onValueChange = vi.fn();

      await render(
        // `snapOnStep` makes a zero-amount step observable: it would snap 3.5 down to 3.
        <NumberField.Root defaultValue={3.5} step={1} snapOnStep onValueChange={onValueChange}>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area" pixelSensitivity={0}>
            <NumberField.ScrubAreaCursor />
          </NumberField.ScrubArea>
        </NumberField.Root>,
      );

      const scrubArea = screen.getByTestId('scrub-area');

      scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
      scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 0 }));
      await flushMicrotasks();

      expect(screen.getByRole('textbox')).toHaveValue(new Intl.NumberFormat().format(3.5));
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('should only increment if the pointer movement was greater than or equal to the value', async () => {
      await render(
        <NumberField.Root defaultValue={0}>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area" pixelSensitivity={5}>
            <NumberField.ScrubAreaCursor />
          </NumberField.ScrubArea>
        </NumberField.Root>,
      );

      const scrubArea = screen.getByTestId('scrub-area');
      const input = screen.getByRole('textbox');

      scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
      scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: -2 }));
      await flushMicrotasks();

      expect(input).toHaveValue('0');

      scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 2 }));
      await flushMicrotasks();

      expect(input).toHaveValue('0');

      scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 1 }));
      scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 1 }));
      scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 1 }));
      scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 1 }));
      await flushMicrotasks();

      expect(input).toHaveValue('0');

      scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 1 }));
      await flushMicrotasks();

      expect(input).toHaveValue('1');

      scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 5 }));
      await flushMicrotasks();

      expect(input).toHaveValue('6');

      scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: -4 }));
      await flushMicrotasks();

      expect(input).toHaveValue('6');

      scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: -1 }));
      await flushMicrotasks();

      expect(input).toHaveValue('5');

      scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 5 }));
      await flushMicrotasks();

      expect(input).toHaveValue('10');
    });
  });

  describe('prop: teleportDistance', () => {
    it('wraps the virtual cursor around the allowed bounds', async () => {
      // Headless Chromium denies pointer lock, which unmounts the virtual cursor mid-test.
      const pointerLock = vi
        .spyOn(document.body, 'requestPointerLock')
        .mockImplementation(() => Promise.resolve());

      try {
        await render(
          <NumberField.Root defaultValue={0}>
            <NumberField.Input />
            {/* Pin the scrub area so the bounds don't shift as the value (and input width) grows. */}
            <NumberField.ScrubArea
              data-testid="scrub-area"
              teleportDistance={100}
              style={{
                position: 'fixed',
                left: '100px',
                top: '100px',
                width: '20px',
                height: '20px',
              }}
            >
              <NumberField.ScrubAreaCursor data-testid="cursor" />
            </NumberField.ScrubArea>
          </NumberField.Root>,
        );

        const scrubArea = screen.getByTestId('scrub-area');

        scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
        await flushMicrotasks();

        const cursor = screen.getByTestId('cursor');
        // The bare cursor has no size, so its wrap coordinates are the bounds themselves.
        expect(cursor.offsetWidth).toBe(0);

        // Past the right bound (120 + 100 / 2): the cursor reappears at the left one.
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 5000 }));
        await flushMicrotasks();
        expect(cursor.style.transform).toContain('translate3d(50px,');

        // And symmetrically past the left bound (100 - 100 / 2).
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: -5000 }));
        await flushMicrotasks();
        expect(cursor.style.transform).toContain('translate3d(170px,');
      } finally {
        pointerLock.mockRestore();
      }
    });
  });

  describe('prop: direction', () => {
    it('scrubs on vertical movement when direction is vertical', async () => {
      await render(
        <NumberField.Root defaultValue={0}>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area" direction="vertical">
            <NumberField.ScrubAreaCursor />
          </NumberField.ScrubArea>
        </NumberField.Root>,
      );

      const scrubArea = screen.getByTestId('scrub-area');
      const input = screen.getByRole('textbox');

      scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
      scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 10 }));
      await flushMicrotasks();

      expect(input).toHaveValue('0');

      // Upward movement (negative Y) increases the value.
      scrubArea.dispatchEvent(createPointerMoveEvent({ movementY: -10 }));
      await flushMicrotasks();

      expect(input).toHaveValue('10');

      scrubArea.dispatchEvent(createPointerMoveEvent({ movementY: 4 }));
      await flushMicrotasks();

      expect(input).toHaveValue('6');
    });

    it('should only scrub if the pointer moved in the given direction', async () => {
      await render(
        <NumberField.Root defaultValue={0}>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area" direction="horizontal">
            <NumberField.ScrubAreaCursor />
          </NumberField.ScrubArea>
        </NumberField.Root>,
      );

      const scrubArea = screen.getByTestId('scrub-area');
      const input = screen.getByRole('textbox');

      scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
      scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 10 }));
      await flushMicrotasks();

      expect(input).toHaveValue('10');

      scrubArea.dispatchEvent(createPointerMoveEvent({ movementY: 10 }));
      await flushMicrotasks();

      expect(input).toHaveValue('10');
    });
  });

  it('should fire onClick once when clicked without scrubbing', async () => {
    const handleClick = vi.fn();

    await render(
      <NumberField.Root defaultValue={0}>
        <NumberField.ScrubArea
          data-testid="scrub-area"
          onClick={handleClick}
          style={{ display: 'inline-block', width: '100px', height: '40px' }}
        >
          <NumberField.ScrubAreaCursor />
        </NumberField.ScrubArea>
        <NumberField.Input />
      </NumberField.Root>,
    );

    // Real browser input, so the native click and the synthesized one can both happen.
    await userEvent.click(screen.getByTestId('scrub-area'));
    // The synthesized click is deferred by one task (20ms in Firefox).
    await wait(50);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should fire onClick on child elements', async () => {
    const handleScrubAreaClick = vi.fn();
    const handleLabelClick = vi.fn();

    const { user } = await render(
      <NumberField.Root defaultValue={0}>
        <NumberField.ScrubArea onClick={handleScrubAreaClick}>
          <label onClick={handleLabelClick}>Amount</label>
          <NumberField.ScrubAreaCursor />
        </NumberField.ScrubArea>
      </NumberField.Root>,
    );

    await user.click(screen.getByText('Amount'));

    expect(handleLabelClick.mock.calls.length).toBe(1);
    expect(handleScrubAreaClick.mock.calls.length).toBe(1);
  });
});
