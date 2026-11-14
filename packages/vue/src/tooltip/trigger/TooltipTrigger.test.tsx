import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeepAlive, defineComponent, h, shallowRef } from 'vue';
import { Toolbar } from '@vase-ui/vue/toolbar';
import { Tooltip } from '@vase-ui/vue/tooltip';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  isJSDOM,
  screen,
  takeReportedMessages,
  wait,
  waitFor,
} from '#test-utils';
import type { HTMLProps } from '../../internals/types';
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

    async function enter(trigger: HTMLElement) {
      await fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
      await fireEvent.mouseEnter(trigger);
      // The open delay starts when the pointer rests, so it needs a move.
      await fireEvent.mouseMove(trigger);
    }

    async function renderTooltip(triggerProps: Record<string, unknown>) {
      const onOpenChange = vi.fn();
      await render(
        <Tooltip.Root onOpenChange={onOpenChange}>
          <Tooltip.Trigger {...triggerProps}>Trigger</Tooltip.Trigger>
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

    it('does not open while the trigger is disabled', async () => {
      const { trigger, onOpenChange } = await renderTooltip({ delay: 0, disabled: true });

      await enter(trigger);
      await tick(OPEN_DELAY);

      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });

  it('closes a tooltip that the pointer opened when `KeepAlive` deactivates the trigger', async () => {
    const show = shallowRef(true);
    const onOpenChange = vi.fn();
    const Page = defineComponent({
      setup: () => () => (
        <Tooltip.Root onOpenChange={onOpenChange}>
          <Tooltip.Trigger delay={0}>Trigger</Tooltip.Trigger>
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

  it('removes `data-popup-open` as soon as `open` becomes false', async () => {
    const open = shallowRef(false);
    const TooltipWithPreventedUnmount = defineComponent({
      setup: () => () => (
        <Tooltip.Root
          open={open.value}
          onOpenChange={(nextOpen: boolean, eventDetails: Tooltip.Root.ChangeEventDetails) => {
            if (!nextOpen) {
              eventDetails.preventUnmountOnClose();
            }
            open.value = nextOpen;
          }}
        >
          <Tooltip.Trigger data-testid="trigger" delay={0} closeDelay={0}>
            Trigger
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ),
    });

    await render(<TooltipWithPreventedUnmount />);
    const trigger = screen.getByTestId('trigger');

    await fireEvent.mouseEnter(trigger);
    await fireEvent.mouseMove(trigger);
    await flushMicrotasks();
    expect(trigger).toHaveAttribute('data-popup-open');
    expect(screen.getByText('Content')).not.toBe(null);

    await fireEvent.mouseLeave(trigger);
    await flushMicrotasks();
    expect(trigger).not.toHaveAttribute('data-popup-open');
    expect(screen.getByText('Content')).not.toBe(null);
  });

  it('opens when the rendered trigger element has its own id', async () => {
    const { user } = await render(
      <Tooltip.Root>
        <Tooltip.Trigger
          delay={0}
          closeDelay={0}
          v-slots={{
            render: ({ props }: { props: HTMLProps }) => (
              <button {...props} id="custom-button" data-testid="trigger" type="button">
                Trigger
              </button>
            ),
          }}
        />
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const trigger = screen.getByTestId('trigger');

    expect(trigger).toHaveAttribute('id', 'custom-button');

    await user.hover(trigger);

    await screen.findByTestId('popup');
    expect(trigger).toHaveAttribute('data-popup-open');
  });

  it.skipIf(isJSDOM)(
    'opens on delayed hover when rendered as a disabled toolbar button',
    async () => {
      const { user } = await render(
        <Toolbar.Root>
          <Tooltip.Root>
            <Tooltip.Trigger
              delay={20}
              v-slots={{
                render: ({ props }: { props: HTMLProps }) => (
                  <Toolbar.Button {...props} disabled data-testid="trigger">
                    Push
                  </Toolbar.Button>
                ),
              }}
            />
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="popup">Nothing to push</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Toolbar.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveAttribute('disabled');
      expect(trigger).toHaveAttribute('aria-disabled', 'true');

      await user.hover(trigger);

      await screen.findByTestId('popup');
    },
  );

  describe('once the tooltip has unmounted', () => {
    it('stays closed when focus returns to the trigger after leaving the window', async () => {
      const { user } = await render(
        <Tooltip.Root>
          <Tooltip.Trigger>Trigger</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>,
      );
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.keyboard('[Tab]');
      expect(trigger).toHaveFocus();
      await screen.findByTestId('popup');

      await user.keyboard('[Escape]');
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });

      // Leaving the window blurs the trigger, then the window, while the trigger stays the
      // active element; coming back focuses the window, then the trigger.
      await fireEvent.focusOut(trigger);
      await fireEvent.blur(window);
      await fireEvent.focus(window);
      await fireEvent.focusIn(trigger);
      await wait(50);

      expect(screen.queryByTestId('popup')).toBe(null);
    });

    it('does not request an open when its previously active trigger is hovered while the tooltip is open without a trigger', async () => {
      const onOpenChange = vi.fn();

      const App = defineComponent(() => {
        const open = shallowRef(false);
        return () => (
          <>
            <button
              type="button"
              onClick={() => {
                open.value = true;
              }}
            >
              Open externally
            </button>
            <Tooltip.Root
              open={open.value}
              onOpenChange={(nextOpen: boolean, eventDetails: Tooltip.Root.ChangeEventDetails) => {
                onOpenChange(nextOpen, eventDetails);
                open.value = nextOpen;
              }}
            >
              <Tooltip.Trigger delay={50}>Trigger</Tooltip.Trigger>
              <Tooltip.Trigger delay={50}>Other trigger</Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </>
        );
      });

      const { user } = await render(<App />);
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      trigger.focus();
      await flushMicrotasks();
      await screen.findByTestId('popup');
      trigger.blur();
      await flushMicrotasks();
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });

      await user.click(screen.getByRole('button', { name: 'Open externally' }));
      await screen.findByTestId('popup');
      onOpenChange.mockClear();

      await user.hover(trigger);
      await wait(100);

      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });

  it('opens only the tooltip of a nested trigger that gets the focus', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger as="span">
          Outer
          <Tooltip.Root>
            <Tooltip.Trigger>Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    screen.getByRole('button', { name: 'Inner' }).focus();
    await flushMicrotasks();

    expect(screen.getByTestId('inner-popup')).toHaveAttribute('data-open');
    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('keeps a tooltip that follows the cursor open when a trigger with `closeOnClick` false is pressed', async () => {
    const handle = Tooltip.createHandle();
    await render(
      <>
        <Tooltip.Trigger handle={handle} id="first">
          First
        </Tooltip.Trigger>
        <Tooltip.Trigger handle={handle} id="second" closeOnClick={false}>
          Second
        </Tooltip.Trigger>
        <Tooltip.Root handle={handle} trackCursorAxis="both">
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </>,
    );

    handle.open('first');
    await screen.findByTestId('popup');

    const second = screen.getByRole('button', { name: 'Second' });
    await fireEvent.pointerDown(second, { pointerType: 'mouse' });
    await fireEvent.click(second);
    await flushMicrotasks();

    expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
  });

  it('throws a descriptive error when rendered without a root or a handle', async () => {
    await expect(render(<Tooltip.Trigger>Trigger</Tooltip.Trigger>)).rejects.toThrow(
      'Vase UI: <Tooltip.Trigger> must be inside <Tooltip.Root>, or it must have a `handle`.',
    );
    expect(takeReportedMessages()).toHaveLength(1);
  });
});
