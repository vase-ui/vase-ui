import { describe, expect, it, vi } from 'vitest';
import { defineComponent, onMounted, shallowRef, watch } from 'vue';
import type { PropType } from 'vue';
import * as Menu from '../index.parts';
import { createRenderer, nextEvent, screen, waitFor, waitForLaterMillisecond } from '#test-utils';

type PopupState = Pick<Menu.Popup.State, 'open' | 'transitionStatus'>;

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

describe('Menu popup transition state', () => {
  const { render } = createRenderer();

  it.each(
    [
      { controlled: false, keepMounted: false, defaultOpen: false },
      { controlled: false, keepMounted: false, defaultOpen: true },
      { controlled: false, keepMounted: true, defaultOpen: false },
      { controlled: false, keepMounted: true, defaultOpen: true },
      { controlled: true, keepMounted: false, defaultOpen: false },
      { controlled: true, keepMounted: false, defaultOpen: true },
      { controlled: true, keepMounted: true, defaultOpen: false },
      { controlled: true, keepMounted: true, defaultOpen: true },
    ].flatMap((testCase) => [
      { ...testCase, ancestorContainer: false },
      { ...testCase, ancestorContainer: true },
    ]),
  )(
    'starts each opening once (controlled=$controlled, keepMounted=$keepMounted, defaultOpen=$defaultOpen, ancestorContainer=$ancestorContainer)',
    async ({ controlled, keepMounted, defaultOpen, ancestorContainer }) => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const states: PopupState[] = [];
      function onState(state: PopupState) {
        const previous = states[states.length - 1];
        if (
          previous?.open !== state.open ||
          previous?.transitionStatus !== state.transitionStatus
        ) {
          states.push(state);
        }
      }
      const completed = vi.fn();

      const TestMenu = defineComponent({
        setup() {
          const open = shallowRef(defaultOpen);
          const container = shallowRef<HTMLDivElement | null>(null);
          return () => (
            <div ref={container} data-testid="container">
              <style>{`
                .transition-state-popup { opacity: 0; transition: opacity 10s linear; }
                .transition-state-popup[data-enter] { opacity: 1; }
              `}</style>
              <Menu.Root
                open={controlled ? open.value : undefined}
                defaultOpen={defaultOpen}
                onOpenChange={(value: boolean) => {
                  open.value = value;
                }}
                onOpenChangeComplete={completed}
              >
                <Menu.Trigger>Toggle</Menu.Trigger>
                <Menu.Portal
                  keepMounted={keepMounted}
                  to={ancestorContainer ? container.value : undefined}
                  data-testid="portal"
                >
                  <Menu.Positioner>
                    <Menu.Popup
                      class="transition-state-popup"
                      v-slots={{
                        render: ({
                          props,
                          state,
                        }: {
                          props: Record<string, unknown>;
                          state: Menu.Popup.State;
                        }) => (
                          <TrackedPopup {...props} state={state} onState={onState}>
                            <Menu.Item>Item</Menu.Item>
                          </TrackedPopup>
                        ),
                      }}
                    />
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            </div>
          );
        },
      });

      const { user } = await render(<TestMenu />);

      // The transition outlasts every phase of this test, so a busy runner cannot miss the
      // window where it still runs. Finishing it then ends the phase instead of racing it.
      async function expectCompletedAfterAnimations(popup: HTMLElement, open: boolean) {
        await waitFor(() => {
          popup.getAnimations().forEach((animation) => animation.finish());
          expect(completed).toHaveBeenCalledExactlyOnceWith(open);
        });
      }

      // The listener records the start of the transition, so the case does not poll the
      // animations while they run.
      function startTransition(action: () => Promise<void>) {
        return nextEvent(document, 'transitionrun', { action });
      }

      async function openMenu() {
        states.length = 0;
        completed.mockClear();
        await waitForLaterMillisecond(() =>
          startTransition(() => user.click(screen.getByRole('button', { name: 'Toggle' }))),
        );
        const popup = screen.getByRole('menu');
        expect(completed).not.toHaveBeenCalled();
        await expectCompletedAfterAnimations(popup, true);
        expect(popup.getAnimations()).toHaveLength(0);
        expect(states.filter((state) => state.open)).toEqual([
          { open: true, transitionStatus: 'starting' },
          { open: true, transitionStatus: undefined },
        ]);
      }

      async function expectInitialOpen() {
        await waitFor(() => expect(completed).toHaveBeenCalledExactlyOnceWith(true));
        expect(states).toEqual([{ open: true, transitionStatus: undefined }]);
      }

      if (defaultOpen) {
        await expectInitialOpen();
      } else {
        await openMenu();
      }

      expect(screen.getByTestId('portal').parentElement).toBe(
        ancestorContainer ? screen.getByTestId('container') : document.body,
      );

      async function closeAndReopen() {
        completed.mockClear();
        const popup = screen.getByRole('menu');
        await startTransition(() => user.keyboard('{Escape}'));
        expect(completed).not.toHaveBeenCalled();
        await expectCompletedAfterAnimations(popup, false);
        expect(popup.isConnected).toBe(keepMounted);
        await openMenu();
      }
      await closeAndReopen();
      if (defaultOpen && keepMounted) {
        // Initial-open state must not affect later opening cycles.
        await closeAndReopen();
      }

      // A reversed exit keeps the lifecycle mounted. It must not start a new entry phase
      // or report completion for the canceled close.
      completed.mockClear();
      const popup = screen.getByRole('menu');
      await startTransition(() => user.keyboard('{Escape}'));
      expect(completed).not.toHaveBeenCalled();
      states.length = 0;
      await user.click(screen.getByRole('button', { name: 'Toggle' }));
      // The reopen handler can run after the click resolves. Do not finish the exit first.
      await waitFor(() => expect(popup).toHaveAttribute('data-open'));
      await expectCompletedAfterAnimations(popup, true);
      expect(screen.getByRole('menu')).toBe(popup);
      expect(states.some((state) => state.transitionStatus === 'starting')).toBe(false);
      expect(popup.getAnimations()).toHaveLength(0);
    },
  );
});
