import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Tooltip from '../index.parts';
import { createRenderer, fireEvent, flushMicrotasks, screen } from '#test-utils';
import { OPEN_DELAY } from '../utils/constants';

// The cases dispatch hover events. The real pointer of the browser can rest on a trigger and send
// events of its own, so each trigger ignores it. A dispatched event still reaches the trigger.
const ignoreRealPointer = { pointerEvents: 'none' } as const;

describe('<Tooltip.Provider />', () => {
  const { render } = createRenderer();

  function withFakeTimers() {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });
  }

  async function tick(ms: number) {
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(ms);
    await flushMicrotasks();
  }

  describe('prop: delay', () => {
    withFakeTimers();

    it('waits for the delay before showing the tooltip', async () => {
      await render(
        <Tooltip.Provider delay={10_000}>
          <Tooltip.Root>
            <Tooltip.Trigger style={ignoreRealPointer} />
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>,
      );

      const trigger = screen.getByRole('button');

      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);

      await flushMicrotasks();

      expect(screen.queryByText('Content')).toBe(null);

      await tick(1_000);

      expect(screen.queryByText('Content')).toBe(null);

      await tick(9_000);

      expect(screen.queryByText('Content')).not.toBe(null);
    });

    it('respects delay=0', async () => {
      await render(
        <Tooltip.Provider delay={0}>
          <Tooltip.Root>
            <Tooltip.Trigger style={ignoreRealPointer} />
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>,
      );

      const trigger = screen.getByRole('button');

      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);

      await flushMicrotasks();

      await tick(0);

      expect(screen.queryByText('Content')).not.toBe(null);
    });

    it('respects trigger delay prop over provider delay prop', async () => {
      await render(
        <Tooltip.Provider delay={10}>
          <Tooltip.Root>
            <Tooltip.Trigger delay={100} style={ignoreRealPointer} />
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>,
      );

      const trigger = screen.getByRole('button');

      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);

      await flushMicrotasks();

      expect(screen.queryByText('Content')).toBe(null);

      await tick(99);

      expect(screen.queryByText('Content')).toBe(null);

      await tick(1);

      expect(screen.queryByText('Content')).not.toBe(null);
    });
  });

  describe('prop: closeDelay', () => {
    withFakeTimers();

    it('waits for the closeDelay before hiding the tooltip', async () => {
      await render(
        <Tooltip.Provider closeDelay={400}>
          <Tooltip.Root>
            <Tooltip.Trigger style={ignoreRealPointer} />
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>,
      );

      const trigger = screen.getByRole('button');

      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);

      await flushMicrotasks();

      await tick(OPEN_DELAY);

      expect(screen.queryByText('Content')).not.toBe(null);

      await fireEvent.mouseLeave(trigger);

      await flushMicrotasks();

      await tick(300);

      expect(screen.queryByText('Content')).not.toBe(null);

      await tick(300);

      expect(screen.queryByText('Content')).toBe(null);
    });

    it('uses the latest closeDelay after the prop updates', async () => {
      function Test({ closeDelay }: { closeDelay: number }) {
        return (
          <Tooltip.Provider closeDelay={closeDelay}>
            <Tooltip.Root>
              <Tooltip.Trigger style={ignoreRealPointer} />
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup>Content</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        );
      }

      const { rerender } = await render(<Test closeDelay={400} />);

      const trigger = screen.getByRole('button');

      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);

      await flushMicrotasks();

      await tick(OPEN_DELAY);

      expect(screen.queryByText('Content')).not.toBe(null);

      await rerender(<Test closeDelay={1000} />);

      await fireEvent.mouseLeave(trigger);

      await flushMicrotasks();

      await tick(999);

      expect(screen.queryByText('Content')).not.toBe(null);

      await tick(1);

      expect(screen.queryByText('Content')).toBe(null);
    });
  });

  describe('prop: timeout', () => {
    withFakeTimers();

    function TwoTooltips({
      timeout,
      providerDelay = 100,
      triggerDelay,
    }: {
      timeout: number;
      providerDelay?: number;
      triggerDelay?: number;
    }) {
      return (
        <Tooltip.Provider delay={providerDelay} timeout={timeout}>
          {['One', 'Two'].map((name) => (
            <Tooltip.Root key={name}>
              <Tooltip.Trigger delay={triggerDelay} style={ignoreRealPointer}>
                {name}
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup>{`Content ${name}`}</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          ))}
        </Tooltip.Provider>
      );
    }

    it('opens an adjacent tooltip instantly while the group is active', async () => {
      await render(<TwoTooltips timeout={400} />);

      const first = screen.getByRole('button', { name: 'One' });
      const second = screen.getByRole('button', { name: 'Two' });

      await fireEvent.mouseEnter(first);
      await fireEvent.mouseMove(first);
      await flushMicrotasks();
      await tick(100);

      expect(screen.queryByText('Content One')).not.toBe(null);

      await fireEvent.mouseLeave(first);
      await fireEvent.mouseEnter(second);
      await fireEvent.mouseMove(second);
      await flushMicrotasks();
      await tick(0);

      expect(screen.queryByText('Content Two')).not.toBe(null);
      expect(screen.queryByText('Content One')).toBe(null);
    });

    it('respects a trigger delay over delay=0 outside the instant phase', async () => {
      await render(<TwoTooltips timeout={400} providerDelay={0} triggerDelay={100} />);

      const first = screen.getByRole('button', { name: 'One' });
      const second = screen.getByRole('button', { name: 'Two' });

      await fireEvent.mouseEnter(first);
      await fireEvent.mouseMove(first);
      await flushMicrotasks();

      await tick(99);
      expect(screen.queryByText('Content One')).toBe(null);

      await tick(1);
      expect(screen.queryByText('Content One')).not.toBe(null);

      await fireEvent.mouseLeave(first);
      await fireEvent.mouseEnter(second);
      await fireEvent.mouseMove(second);
      await flushMicrotasks();
      await tick(0);

      expect(screen.queryByText('Content Two')).not.toBe(null);
      expect(screen.queryByText('Content One')).toBe(null);

      await fireEvent.mouseLeave(second);
      await flushMicrotasks();
      await tick(400);

      await fireEvent.mouseEnter(first);
      await fireEvent.mouseMove(first);
      await flushMicrotasks();

      await tick(99);
      expect(screen.queryByText('Content One')).toBe(null);

      await tick(1);
      expect(screen.queryByText('Content One')).not.toBe(null);
    });

    it('requires the full delay again once the timeout elapses', async () => {
      await render(<TwoTooltips timeout={400} />);

      const first = screen.getByRole('button', { name: 'One' });
      const second = screen.getByRole('button', { name: 'Two' });

      await fireEvent.mouseEnter(first);
      await fireEvent.mouseMove(first);
      await flushMicrotasks();
      await tick(100);

      expect(screen.queryByText('Content One')).not.toBe(null);

      await fireEvent.mouseLeave(first);
      await flushMicrotasks();
      await tick(400);

      await fireEvent.mouseEnter(second);
      await fireEvent.mouseMove(second);
      await flushMicrotasks();

      expect(screen.queryByText('Content Two')).toBe(null);

      await tick(100);

      expect(screen.queryByText('Content Two')).not.toBe(null);
    });
  });
});
