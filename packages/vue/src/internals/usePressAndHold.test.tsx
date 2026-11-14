import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { createRenderer, fireEvent, flushMicrotasks, screen } from '#test-utils';
import { usePressAndHold } from './usePressAndHold';
import type { UsePressAndHoldParameters } from './usePressAndHold';

type HoldOptions = Pick<UsePressAndHoldParameters, 'startDelay' | 'tickDelay' | 'scrollDistance'>;

// Mirrors the touch settle delay in `usePressAndHold`.
const TOUCH_TIMEOUT = 50;

async function advance(milliseconds: number) {
  vi.advanceTimersByTime(milliseconds);
  await flushMicrotasks();
}

function defineHoldButton(options: HoldOptions, tick: () => boolean) {
  return defineComponent(() => {
    const button = shallowRef<HTMLButtonElement | null>(null);
    const { pointerHandlers } = usePressAndHold({
      disabled: false,
      tick,
      elementRef: button,
      ...options,
    });
    return () => (
      <button ref={button} {...pointerHandlers}>
        hold
      </button>
    );
  });
}

describe('usePressAndHold', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('repeats the tick after `startDelay`, at the interval `tickDelay`', async () => {
    const tick = vi.fn(() => true);
    const Hold = defineHoldButton({ startDelay: 100, tickDelay: 10 }, tick);
    await render(<Hold />);

    await fireEvent.pointerDown(screen.getByRole('button'), { pointerType: 'mouse' });
    expect(tick).toHaveBeenCalledTimes(1);

    await advance(109);
    expect(tick).toHaveBeenCalledTimes(1);

    await advance(1);
    expect(tick).toHaveBeenCalledTimes(2);

    await advance(10);
    expect(tick).toHaveBeenCalledTimes(3);

    await fireEvent.pointerUp(screen.getByRole('button'), { pointerType: 'mouse' });
  });

  it('reads `startDelay` when a hold starts', async () => {
    const startDelay = shallowRef(100);
    const tick = vi.fn(() => true);
    const Hold = defineHoldButton({ startDelay, tickDelay: 10 }, tick);
    await render(<Hold />);
    const button = screen.getByRole('button');

    await fireEvent.pointerDown(button, { pointerType: 'mouse' });
    await advance(110);
    expect(tick).toHaveBeenCalledTimes(2);
    await fireEvent.pointerUp(button, { pointerType: 'mouse' });

    startDelay.value = 300;
    tick.mockClear();

    await fireEvent.pointerDown(button, { pointerType: 'mouse' });
    await advance(309);
    expect(tick).toHaveBeenCalledTimes(1);

    await advance(1);
    expect(tick).toHaveBeenCalledTimes(2);

    await fireEvent.pointerUp(button, { pointerType: 'mouse' });
  });

  it.each([
    { name: 'no hold after a move over the distance', scrollDistance: 3, ticks: [0, 0] },
    { name: 'a hold after a move under the distance', scrollDistance: 8, ticks: [1, 2] },
  ])('a touch press starts $name', async ({ scrollDistance, ticks }) => {
    const tick = vi.fn(() => true);
    const Hold = defineHoldButton({ startDelay: 100, tickDelay: 10, scrollDistance }, tick);
    await render(<Hold />);
    const button = screen.getByRole('button');

    await fireEvent.pointerDown(button, { pointerType: 'touch', clientX: 0, clientY: 0 });
    // The move is 4px, which is over 3px and under 8px.
    await fireEvent.pointerMove(button, { pointerType: 'touch', clientX: 4, clientY: 0 });

    await advance(TOUCH_TIMEOUT);
    expect(tick).toHaveBeenCalledTimes(ticks[0]);

    // The first repeat comes `startDelay` and `tickDelay` after the first tick.
    await advance(110);
    expect(tick).toHaveBeenCalledTimes(ticks[1]);

    await fireEvent.pointerUp(button, { pointerType: 'touch' });
  });

  it('prevents the context menu during a hold and no longer after the release', async () => {
    const Hold = defineHoldButton({}, () => true);
    await render(<Hold />);
    const button = screen.getByRole('button');

    expect(await fireEvent.contextMenu(button)).toBe(true);

    await fireEvent.pointerDown(button, { pointerType: 'mouse' });
    expect(await fireEvent.contextMenu(button)).toBe(false);

    await fireEvent.pointerUp(button, { pointerType: 'mouse' });
    expect(await fireEvent.contextMenu(button)).toBe(true);
  });
});
