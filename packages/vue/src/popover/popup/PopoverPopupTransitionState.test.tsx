import { describe, expect, it, vi } from 'vitest';
import { defineComponent, onMounted, watch } from 'vue';
import type { PropType } from 'vue';
import * as Popover from '../index.parts';
import { createRenderer, nextAnimationsRead, screen, waitFor, waitSingleFrame } from '#test-utils';

type PopupState = Pick<Popover.Popup.State, 'open' | 'transitionStatus'>;

const TrackedPopup = defineComponent({
  inheritAttrs: false,
  props: {
    state: { type: Object as PropType<PopupState>, required: true },
    onState: { type: Function as PropType<(state: PopupState) => void>, required: true },
  },
  setup(props, { attrs, slots }) {
    function report() {
      props.onState({ open: props.state.open, transitionStatus: props.state.transitionStatus });
    }
    onMounted(report);
    watch(() => [props.state.open, props.state.transitionStatus], report);

    return () => {
      const { open, transitionStatus } = props.state;
      // This is the input used by transition components such as Material UI Grow.
      const enter = open && transitionStatus !== 'starting';
      return (
        <div {...attrs} data-enter={enter || undefined}>
          {slots.default?.()}
        </div>
      );
    };
  },
});

describe('Popover popup transition state', () => {
  const { render } = createRenderer();

  it('starts each opening once when the popup is kept mounted', async () => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    const states: PopupState[] = [];
    function onState(state: PopupState) {
      const previous = states[states.length - 1];
      if (previous?.open !== state.open || previous?.transitionStatus !== state.transitionStatus) {
        states.push(state);
      }
    }
    const completed = vi.fn();

    const { user } = await render(
      <>
        <style>{`
          .transition-state-popup { opacity: 0; transition: opacity 100s linear; }
          .transition-state-popup[data-enter] { opacity: 1; }
        `}</style>
        <Popover.Root onOpenChangeComplete={completed}>
          <Popover.Trigger>Toggle</Popover.Trigger>
          <Popover.Portal keepMounted>
            <Popover.Positioner>
              <Popover.Popup
                class="transition-state-popup"
                data-testid="popup"
                v-slots={{
                  render: ({
                    props,
                    state,
                  }: {
                    props: Record<string, unknown>;
                    state: Popover.Popup.State;
                  }) => (
                    <TrackedPopup {...props} state={state} onState={onState}>
                      Content
                    </TrackedPopup>
                  ),
                }}
              />
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </>,
    );
    const trigger = screen.getByRole('button', { name: 'Toggle' });
    const popup = await screen.findByTestId('popup');
    // The popup reads its animations in a frame after the mount. That read must not be the read
    // that the first phase takes.
    await waitSingleFrame();
    await waitSingleFrame();

    // The transition lasts longer than any phase of the test, so it cannot end before it is
    // observed on a busy runner. Each phase is finished explicitly instead of waited out.
    async function runPhase(action: () => Promise<void>) {
      const animations = await nextAnimationsRead(popup, { action });
      expect(animations.length).toBeGreaterThan(0);
      expect(completed).not.toHaveBeenCalled();
      animations.forEach((animation) => animation.finish());
    }

    async function openPopover() {
      states.length = 0;
      completed.mockClear();
      await runPhase(() => user.click(trigger));
      await waitFor(() => expect(completed).toHaveBeenCalledExactlyOnceWith(true));
      expect(states.filter((state) => state.open)).toEqual([
        { open: true, transitionStatus: 'starting' },
        { open: true, transitionStatus: undefined },
      ]);
    }

    async function closePopover() {
      completed.mockClear();
      await runPhase(() => user.keyboard('{Escape}'));
      await waitFor(() => expect(completed).toHaveBeenCalledExactlyOnceWith(false));
      // `keepMounted` retains the element, so the next opening reuses it.
      expect(popup.isConnected).toBe(true);
    }

    await openPopover();
    await closePopover();
    await openPopover();
    expect(screen.getByTestId('popup')).toBe(popup);
  });
});
