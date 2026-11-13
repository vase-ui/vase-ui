import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeepAlive, defineComponent, h, shallowRef } from 'vue';
import { Tooltip } from '@vase-ui/vue/tooltip';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
  takeReportedMessages,
} from '#test-utils';
import { OPEN_DELAY } from '../utils/constants';

describe('<Tooltip.Trigger />', () => {
  const { render } = createRenderer();

  describeConformance(<Tooltip.Trigger />, () => ({
    refInstanceof: window.HTMLButtonElement,
    render(node) {
      return render(<Tooltip.Root>{node}</Tooltip.Root>);
    },
  }));

  describe('hover', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    async function tick(ms: number) {
      vi.advanceTimersByTime(ms);
      await flushMicrotasks();
    }

    async function enter(trigger: HTMLElement, pointerType = 'mouse') {
      await fireEvent.pointerEnter(trigger, { pointerType });
      await fireEvent.mouseEnter(trigger);
      // The open delay starts when the pointer rests, so it needs a move.
      await fireEvent.mouseMove(trigger);
    }

    async function renderTooltip(
      triggerProps: Record<string, unknown> = {},
      rootProps: Record<string, unknown> = {},
    ) {
      const onOpenChange = vi.fn();
      await render(
        <Tooltip.Root onOpenChange={onOpenChange} {...rootProps}>
          <Tooltip.Trigger style={{ pointerEvents: 'none' }} {...triggerProps}>
            Trigger
          </Tooltip.Trigger>
        </Tooltip.Root>,
      );
      return { trigger: screen.getByRole('button', { name: 'Trigger' }), onOpenChange };
    }

    it.each([
      { name: 'the default delay', triggerProps: {}, delay: OPEN_DELAY },
      { name: 'the `delay` prop', triggerProps: { delay: 100 }, delay: 100 },
    ])('opens when the pointer rests on the trigger for $name', async ({ triggerProps, delay }) => {
      const { trigger, onOpenChange } = await renderTooltip(triggerProps);

      await enter(trigger);
      await tick(delay - 1);
      expect(trigger).not.toHaveAttribute('data-popup-open');

      await tick(1);

      expect(trigger).toHaveAttribute('data-popup-open');
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange.mock.calls[0][0]).toBe(true);
      expect(onOpenChange.mock.calls[0][1].reason).toBe('trigger-hover');
      expect(onOpenChange.mock.calls[0][1].trigger).toBe(trigger);
    });

    it.each([
      { name: 'at once with no `closeDelay`', triggerProps: { delay: 0 }, closeDelay: 0 },
      {
        name: 'after the `closeDelay`',
        triggerProps: { delay: 0, closeDelay: 100 },
        closeDelay: 100,
      },
    ])('closes $name when the pointer leaves the trigger', async ({ triggerProps, closeDelay }) => {
      const { trigger, onOpenChange } = await renderTooltip(triggerProps);
      await enter(trigger);
      await tick(0);
      expect(trigger).toHaveAttribute('data-popup-open');

      await fireEvent.mouseLeave(trigger);
      if (closeDelay > 0) {
        await tick(closeDelay - 1);
        expect(trigger).toHaveAttribute('data-popup-open');
        await tick(1);
      }

      expect(trigger).not.toHaveAttribute('data-popup-open');
      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe('trigger-hover');
    });

    it('does not open for a touch pointer', async () => {
      const { trigger, onOpenChange } = await renderTooltip({ delay: 0 });

      await enter(trigger, 'touch');
      await tick(OPEN_DELAY);

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it.each([
      {
        name: 'the trigger is disabled',
        triggerProps: { delay: 0, disabled: true },
        rootProps: {},
      },
      {
        name: 'the tooltip is disabled',
        triggerProps: { delay: 0 },
        rootProps: { disabled: true },
      },
    ])('does not open while $name', async ({ triggerProps, rootProps }) => {
      const { trigger, onOpenChange } = await renderTooltip(triggerProps, rootProps);

      await enter(trigger);
      await tick(OPEN_DELAY);

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it.each([
      { name: 'cancels an open that waits', closeOnClick: true, calls: 0 },
      { name: 'keeps the open with `closeOnClick` false', closeOnClick: false, calls: 1 },
    ])('$name when the trigger is pressed', async ({ closeOnClick, calls }) => {
      const { trigger, onOpenChange } = await renderTooltip({ delay: 100, closeOnClick });

      await enter(trigger);
      await tick(50);
      await fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
      await fireEvent.click(trigger);
      await tick(100);

      expect(onOpenChange).toHaveBeenCalledTimes(calls);
    });
  });

  it('closes a tooltip that the pointer opened when `KeepAlive` deactivates the trigger', async () => {
    const show = shallowRef(true);
    const onOpenChange = vi.fn();
    const Page = defineComponent({
      setup: () => () => (
        <Tooltip.Root onOpenChange={onOpenChange}>
          <Tooltip.Trigger delay={0} style={{ pointerEvents: 'none' }}>
            Trigger
          </Tooltip.Trigger>
        </Tooltip.Root>
      ),
    });
    const App = defineComponent({
      setup: () => () => h(KeepAlive, null, { default: () => (show.value ? h(Page) : null) }),
    });
    await render(<App />);
    const trigger = screen.getByRole('button', { name: 'Trigger' });
    await fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
    await fireEvent.mouseEnter(trigger);
    expect(trigger).toHaveAttribute('data-popup-open');

    show.value = false;
    await flushMicrotasks();
    show.value = true;
    await flushMicrotasks();

    expect(onOpenChange.mock.calls.map((call) => [call[0], call[1].reason])).toEqual([
      [true, 'trigger-hover'],
      [false, 'trigger-hover'],
    ]);
    expect(screen.getByRole('button', { name: 'Trigger' })).not.toHaveAttribute('data-popup-open');
  });

  it('throws a descriptive error when rendered without a root or a handle', async () => {
    await expect(render(<Tooltip.Trigger>Trigger</Tooltip.Trigger>)).rejects.toThrow(
      'Vase UI: <Tooltip.Trigger> must be inside <Tooltip.Root>, or it must have a `handle`.',
    );
    expect(takeReportedMessages()).toHaveLength(1);
  });
});
