import { describe, expect, it } from 'vitest';
import * as Popover from '../index.parts';
import { createRenderer, describeConformance, flushMicrotasks, screen, waitFor } from '#test-utils';

describe('<Popover.Arrow />', () => {
  const { render } = createRenderer();

  describeConformance(<Popover.Arrow />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(
        <Popover.Root open>
          <Popover.Trigger>Trigger</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>{node}</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));

  it('is hidden from assistive technology and points at the center of the trigger', async () => {
    await render(
      <div style={{ position: 'fixed', top: 0, left: 0 }}>
        <Popover.Root open>
          <Popover.Trigger style={{ width: '200px', height: '20px' }}>Trigger</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup style={{ width: '100px', height: '40px' }}>
                <Popover.Arrow data-testid="arrow" style={{ width: '10px', height: '10px' }} />
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </div>,
    );
    await flushMicrotasks();

    const arrow = screen.getByTestId('arrow');
    expect(arrow).toHaveAttribute('aria-hidden', 'true');
    expect(arrow).toHaveAttribute('data-open');
    expect(arrow).toHaveAttribute('data-side', 'bottom');
    expect(arrow).toHaveAttribute('data-align', 'center');
    expect(arrow.style.position).toBe('absolute');
    // The popup is centered below the trigger, so the center of the trigger is the center of the
    // popup: 100 / 2 - 10 / 2.
    await waitFor(() => {
      expect(arrow.style.left).toBe('45px');
    });
  });
});
