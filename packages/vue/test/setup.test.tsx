import { afterAll, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { defineComponent, onMounted, onUnmounted, shallowRef } from 'vue';
import type { CSSProperties } from 'vue';
import { createRenderer, screen, takeReportedMessages, waitSingleFrame } from '#test-utils';

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

describe('real pointer between tests', () => {
  // Vitest runs the tests of a file in order. The first test only moves the real pointer onto an
  // element. The element of the second test is at the same place.
  const { render } = createRenderer();
  const SPOT: CSSProperties = {
    position: 'fixed',
    left: '0px',
    top: '0px',
    width: '100px',
    height: '100px',
  };

  it('moves the real pointer onto an element and ends', async () => {
    await render(<div data-testid="spot" style={SPOT} />);
    await userEvent.hover(screen.getByTestId('spot'));
  });

  it('gets no hover event from the real pointer of the last test', async () => {
    const onPointerover = vi.fn();
    await render(<div style={SPOT} onPointerover={onPointerover} />);
    // The browser sends the hover events of a pointer that does not move in the next frame.
    await waitSingleFrame();
    await waitSingleFrame();

    expect(onPointerover).not.toHaveBeenCalled();
  });
});
