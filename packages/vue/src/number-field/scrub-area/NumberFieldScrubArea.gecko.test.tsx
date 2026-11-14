import { afterEach, beforeEach, describe, expect, vi, it } from 'vitest';
import { NumberField } from '@vase-ui/vue/number-field';
import { createRenderer, flushMicrotasks, isJSDOM, screen } from '#test-utils';
import { platform } from '../../common/platform';

vi.mock('../../common/platform', async () => {
  const actual =
    await vi.importActual<typeof import('../../common/platform')>('../../common/platform');

  return {
    ...actual,
    platform: {
      ...actual.platform,
      engine: { ...actual.platform.engine, gecko: true },
    },
  };
});

// Scrubbing relies on real pointer movement, which only the Chromium/Firefox runners provide.
describe.skipIf(isJSDOM || platform.engine.webkit)('<NumberField.ScrubArea /> on Gecko', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('delays releasing the pointer lock so soft clicks are not swallowed', async () => {
    const onValueCommitted = vi.fn();

    await render(
      <NumberField.Root defaultValue={0} data-testid="root" onValueCommitted={onValueCommitted}>
        <NumberField.Input />
        <NumberField.ScrubArea data-testid="scrub-area">
          <NumberField.ScrubAreaCursor />
        </NumberField.ScrubArea>
      </NumberField.Root>,
    );

    const scrubArea = screen.getByTestId('scrub-area');
    const root = screen.getByTestId('root');
    const box = scrubArea.getBoundingClientRect();

    scrubArea.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        clientX: box.left + box.width / 2,
        clientY: box.top + box.height / 2,
      }),
    );
    scrubArea.dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, movementX: 10, movementY: 0 }),
    );
    await flushMicrotasks();

    expect(screen.getByRole('textbox')).toHaveValue('10');

    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    await flushMicrotasks();

    // Firefox needs the pointer lock to outlive the release, so the scrub is still open here.
    expect(onValueCommitted).not.toHaveBeenCalled();
    expect(root).toHaveAttribute('data-scrubbing');

    vi.advanceTimersByTime(20);
    await flushMicrotasks();

    expect(onValueCommitted.mock.calls.length).toBe(1);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(10);
    expect(root).not.toHaveAttribute('data-scrubbing');
  });
});
