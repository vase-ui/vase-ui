import { afterAll, describe, expect, it, onTestFinished, vi } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { defineComponent, onMounted, onUnmounted, shallowRef } from 'vue';
import type { CSSProperties } from 'vue';
import {
  createRenderer,
  screen,
  takeReportedMessages,
  waitFor,
  waitSingleFrame,
} from '#test-utils';

describe('test setup', () => {
  const { render } = createRenderer();

  it('gives toBeVisible the meaning of @testing-library/jest-dom: an empty element in the document is visible', async () => {
    await render(<div data-testid="empty" />);

    expect(screen.getByTestId('empty')).toBeVisible();
  });
});

describe('task boundary between tests', () => {
  // Vitest runs the tests of a file in order. In a pair, the first test only makes the state that
  // the second test reads.

  describe('a test that ends in a ResizeObserver callback', () => {
    const { render } = createRenderer();

    const ObservedBox = defineComponent(
      (props: { onResize?: () => void }) => {
        const element = shallowRef<HTMLDivElement | null>(null);
        const observer = new ResizeObserver(() => props.onResize?.());

        onMounted(() => {
          if (element.value) {
            observer.observe(element.value);
          }
        });
        onUnmounted(() => {
          observer.disconnect();
        });

        return () => <div ref={element} style={{ width: '100px', height: '100px' }} />;
      },
      { props: ['onResize'] },
    );

    it('ends in the callback of the observer', async () => {
      let resolveResize = () => {};
      const resized = new Promise<void>((resolve) => {
        resolveResize = resolve;
      });

      await render(<ObservedBox onResize={resolveResize} />);
      await resized;
    });

    it('gets no loop error from the observer of the last test', async () => {
      await render(<ObservedBox />);
      await waitSingleFrame();

      expect(takeReportedMessages()).toEqual([]);
    });
  });

  describe('a test that leaves a 0 ms timer', () => {
    // A plain variable: `vi.resetAllMocks()` of the setup clears a `vi.fn()` between the two tests.
    let hasTimerRun = false;

    it('sets a 0 ms timer and ends', () => {
      setTimeout(() => {
        hasTimerRun = true;
      }, 0);
    });

    it('starts after the timer of the last test ran', () => {
      expect(hasTimerRun).toBe(true);
    });
  });

  describe('a test whose 0 ms timer writes to the console', () => {
    // The wait runs before the check of the messages. The check then sees the message of the timer
    // and fails the test. With the wait after the check, the message reaches the console, the test
    // passes, and `fails` reports an error.
    it('fails a test whose 0 ms timer writes to console.error', { fails: true }, () => {
      setTimeout(() => {
        console.error('text');
      }, 0);
    });
  });

  describe('a test that leaves fake timers on', () => {
    afterAll(() => {
      vi.useRealTimers();
    });

    it('turns fake timers on and ends', () => {
      vi.useFakeTimers();
    });

    it('keeps the fake timers of the last test', () => {
      expect(vi.isFakeTimers()).toBe(true);
    });
  });
});

describe('the page between tests', () => {
  // Vitest runs the tests of a file in order. In each pair, the first test fails, and the second test
  // reads the page.

  // The step after the wait adds an element to `<body>`.
  let isSecondTestRunning = false;
  it('times out in a wait that ends in the next test', { fails: true, timeout: 1 }, async () => {
    await waitFor(() => expect(isSecondTestRunning).toBe(true));
    document.body.append(document.createElement('output'));
  });

  it('gets no element of a step of the last test after its time-out', async () => {
    isSecondTestRunning = true;
    await waitSingleFrame();
    await waitSingleFrame();

    expect(document.body.children).toHaveLength(0);
  });

  it('fails by an element that it leaves in <body>', { fails: true }, () => {
    document.body.append(document.createElement('output'));
  });

  it('starts with an empty <body> after the test that left an element', () => {
    expect(document.body.children).toHaveLength(0);
  });
});

describe('real pointer between tests', () => {
  // Vitest runs the tests of a file in order. In each pair, the first test puts the real pointer on
  // a point. The element of the second test is at that point.
  const { render } = createRenderer();
  const SPOT: CSSProperties = {
    position: 'fixed',
    left: '0px',
    top: '0px',
    width: '100px',
    height: '100px',
  };

  it('puts the real pointer on an element and ends', async () => {
    const onPointerover = vi.fn();
    await render(<div data-testid="spot" style={SPOT} onPointerover={onPointerover} />);
    await userEvent.hover(screen.getByTestId('spot'));

    expect(onPointerover).toHaveBeenCalled();
  });

  it('gets no hover event from the real pointer of the last test', async () => {
    const onPointerover = vi.fn();
    await render(<div style={SPOT} onPointerover={onPointerover} />);
    // For a pointer that does not move, Chromium and Firefox send the hover events in two frames or
    // fewer. WebKit sends them later, so without the move this case fails only in the other two.
    await waitSingleFrame();
    await waitSingleFrame();

    expect(onPointerover).not.toHaveBeenCalled();
  });

  // The first test ends by a time-out while the browser still does its 50 moves.
  it('times out in a pointer move', { fails: true, timeout: 1 }, async () => {
    await userEvent.pointer(Array.from({ length: 50 }, () => ({ coords: { x: 50, y: 50 } })));
  });

  it('gets no hover event from the pointer move of the last test', async () => {
    const onPointerover = vi.fn();
    await render(<div style={SPOT} onPointerover={onPointerover} />);
    await waitSingleFrame();
    await waitSingleFrame();

    expect(onPointerover).not.toHaveBeenCalled();
  });
});

// A probe for the popup would skip the first case if Firefox stopped opening it.
describe.runIf(server.browser === 'firefox')('validation popup of Firefox between tests', () => {
  const { render } = createRenderer();
  const SPOT: CSSProperties = {
    position: 'fixed',
    left: '0px',
    top: '0px',
    width: '200px',
    height: '100px',
  };
  // The next test presses below the input, where Firefox shows the popup.
  const PLACE_OF_POPUP = { position: { x: 50, y: 45 } };

  async function reportInvalidForm(onPointerdown?: () => void) {
    await render(
      <form>
        {/* A press on this element keeps the focus on the input, so it does not close the popup. */}
        <div
          data-testid="spot"
          style={SPOT}
          onPointerdown={onPointerdown}
          onMousedown={(event: MouseEvent) => event.preventDefault()}
        />
        <input
          required
          data-testid="input"
          style={{ position: 'fixed', left: '0px', top: '0px' }}
        />
        <button type="submit">Submit</button>
      </form>,
    );
    screen.getByRole('button', { name: 'Submit' }).click();

    expect(screen.getByTestId('input')).toHaveFocus();
  }

  async function countLostPresses(pressCount: number) {
    const onPointerdown = vi.fn();
    await render(<div data-testid="spot" style={SPOT} onPointerdown={onPointerdown} />);
    for (let press = 0; press < pressCount; press += 1) {
      await userEvent.click(screen.getByTestId('spot'), PLACE_OF_POPUP);
    }
    return pressCount - onPointerdown.mock.calls.length;
  }

  it('reports an invalid form and ends after the popup opens', async () => {
    const onPointerdown = vi.fn();
    await reportInvalidForm(onPointerdown);

    // The page gets no press that the open popup takes.
    let isPopupOpen = false;
    for (let press = 0; press < 200 && !isPopupOpen; press += 1) {
      onPointerdown.mockClear();
      await userEvent.click(screen.getByTestId('spot'), PLACE_OF_POPUP);
      isPopupOpen = onPointerdown.mock.calls.length === 0;
    }

    expect(isPopupOpen).toBe(true);
  });

  it('gets a real press at the place of the open popup of the last test', async () => {
    expect(await countLostPresses(1)).toBe(0);
  });

  it('ends as soon as it reports an invalid form', async () => {
    await reportInvalidForm();
  });

  // A pending popup can let the first press through and take a later one.
  it('gets each real press at the place of the popup that the last test started', async () => {
    expect(await countLostPresses(40)).toBe(0);
  });

  describe('a synthetic invalid event', () => {
    const events: Event[] = [];
    function recordInvalid(event: Event) {
      events.push(event);
    }
    afterAll(() => window.removeEventListener('invalid', recordInvalid, true));

    it('dispatches the event', async () => {
      // A repeat of this case starts a new list.
      events.length = 0;
      await render(<input data-testid="input" />);
      window.addEventListener('invalid', recordInvalid, true);
      screen.getByTestId('input').dispatchEvent(new Event('invalid'));
    });

    it('starts without a validation report from the synthetic event', () => {
      expect(events.map((event) => event.isTrusted)).toEqual([false]);
    });
  });
});

describe('real keyboard between tests', () => {
  // Vitest runs the tests of a file in order. In each pair, the first test ends by a time-out while
  // the browser still does its key command.
  const { render } = createRenderer();

  // The record starts with the test, so it also gets the keys of an earlier command.
  async function typeKeyInNewInput() {
    const keydowns: { key: string; shiftKey: boolean }[] = [];
    function recordKeydown({ key, shiftKey }: KeyboardEvent) {
      keydowns.push({ key, shiftKey });
    }
    window.addEventListener('keydown', recordKeydown, { capture: true });
    onTestFinished(() => {
      window.removeEventListener('keydown', recordKeydown, { capture: true });
    });
    await render(<input data-testid="input" />);
    screen.getByTestId('input').focus();
    await userEvent.keyboard('a');
    return keydowns;
  }

  // The command holds Shift when it ends.
  it('times out in a key command', { fails: true, timeout: 1 }, async () => {
    await userEvent.keyboard(`{Shift>}${'{End}'.repeat(200)}`);
  });

  it('gets no key of the last test and no Shift that it held', async () => {
    expect(await typeKeyInNewInput()).toEqual([{ key: 'a', shiftKey: false }]);
  });

  // The second command is a step of the function after its time-out.
  it('times out in the first of two key commands', { fails: true, timeout: 1 }, async () => {
    await userEvent.keyboard('{End}'.repeat(50));
    await userEvent.keyboard('{End}'.repeat(200));
  });

  it('gets no key of a step of the last test after its time-out', async () => {
    expect(await typeKeyInNewInput()).toEqual([{ key: 'a', shiftKey: false }]);
  });
});

describe('pointer lock', () => {
  // A browser can give a pointer lock to a request that comes in a real press.
  const { render } = createRenderer();

  it('gets no pointer lock for a real press', async () => {
    let refusal: Promise<unknown> | undefined;
    await render(
      <button
        data-testid="button"
        onPointerdown={() => {
          refusal = document.body.requestPointerLock().then(
            () => null,
            (error: unknown) => error,
          );
        }}
      />,
    );
    await userEvent.click(screen.getByTestId('button'));

    expect(await refusal).toBeInstanceOf(DOMException);
    expect(document.pointerLockElement).toBe(null);
  });
});
