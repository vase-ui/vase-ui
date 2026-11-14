import { beforeEach, describe, expect, it } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import {
  createRenderer,
  flushMicrotasks,
  isJSDOM,
  nextAnimationsRead,
  nextEvent,
  screen,
  waitFor,
  waitForPositioned,
} from '#test-utils';
import type { HTMLProps } from '../../internals/types';
import * as Menu from '../index.parts';

// Long enough that a slow run cannot end an animation before the case acts. A case that needs the
// end of an animation ends it itself.
const LONG_ANIMATION_MS = 100_000;

function animationStyles({ positionerMs }: { positionerMs: number }) {
  return `
    .positioner {
      transition:
        top ${positionerMs}ms linear,
        left ${positionerMs}ms linear,
        transform ${positionerMs}ms linear;
    }

    .popup {
      opacity: 1;
      transition: opacity ${LONG_ANIMATION_MS}ms linear;
    }

    .popup[data-ending-style] {
      opacity: 0;
    }

    .positioner[data-instant],
    .popup[data-instant] {
      transition: none;
    }
  `;
}

// The positioner has `transition: none` in its style while the popup enters. A move to another
// trigger in that time jumps. A move after it transitions.
async function waitForSettledPosition(positioner: HTMLElement) {
  await waitForPositioned(positioner);
  await waitFor(() => {
    expect(positioner.style.transition).not.toBe('none');
  });
}

describe('<MenuRoot />', () => {
  beforeEach(() => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render } = createRenderer();

  describe.skipIf(isJSDOM)('multiple detached triggers', () => {
    type NumberPayload = { payload: number | undefined };

    /**
     * Mirrors the Popover detached-trigger hover fixture: two detached hover
     * triggers with a real position transition on the positioner and a real exit
     * transition on the popup, handed off from trigger 1 to trigger 2 so
     * `instantType` is `trigger-change`.
     */
    async function renderHoverDetachedTriggers({
      settleTriggerChange = true,
    }: {
      /**
       * Set to `false` to return while the positioner is still animating to the
       * new trigger, so the delayed `trigger-change` restoration is still pending.
       * The animations of that move then last until the case ends them.
       */
      settleTriggerChange?: boolean;
    } = {}) {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      const testMenu = Menu.createHandle<number>();
      const instantsWhileEnding: (string | undefined)[] = [];

      const utils = await render(
        <div style={{ position: 'relative', width: '400px', height: '200px' }}>
          <style>
            {animationStyles({ positionerMs: settleTriggerChange ? 120 : LONG_ANIMATION_MS })}
          </style>

          <Menu.Trigger
            handle={testMenu}
            payload={1}
            openOnHover
            delay={0}
            style={{ position: 'absolute', top: '20px', left: '20px' }}
          >
            Trigger 1
          </Menu.Trigger>
          <Menu.Trigger
            handle={testMenu}
            payload={2}
            openOnHover
            delay={0}
            style={{ position: 'absolute', top: '20px', left: '220px' }}
          >
            Trigger 2
          </Menu.Trigger>

          <Menu.Root handle={testMenu}>
            {{
              default: ({ payload }: NumberPayload) => (
                <Menu.Portal>
                  <Menu.Positioner data-testid="positioner" class="positioner">
                    <Menu.Popup
                      data-testid="popup"
                      class="popup"
                      v-slots={{
                        render: ({
                          props,
                          state,
                        }: {
                          props: HTMLProps;
                          state: Menu.Popup.State;
                        }) => {
                          if (state.transitionStatus === 'ending') {
                            instantsWhileEnding.push(state.instant);
                          }
                          return (
                            <div {...props}>
                              <Menu.Item data-testid="content">{payload}</Menu.Item>
                            </div>
                          );
                        },
                      }}
                    />
                  </Menu.Positioner>
                </Menu.Portal>
              ),
            }}
          </Menu.Root>
        </div>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await utils.user.hover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });
      await waitForSettledPosition(screen.getByTestId('positioner'));

      // The animations that the positioner starts for the move are the ones that the part waits
      // for, so the case reads them in the same call.
      const switchAnimations = await nextAnimationsRead(screen.getByTestId('positioner'), {
        action: () => utils.user.hover(trigger2),
      });
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('2');
      });

      if (settleTriggerChange) {
        await waitFor(() => {
          expect(screen.getByTestId('popup')).toHaveAttribute('data-instant', 'trigger-change');
        });
      }

      // The handoff itself legitimately renders `trigger-change` while closing
      // the previous trigger's popup. Only the close that follows matters.
      instantsWhileEnding.length = 0;

      return {
        ...utils,
        trigger1,
        trigger2,
        instantsWhileEnding,
        switchAnimations,
        popup: screen.getByTestId('popup'),
      };
    }

    it('does not apply the trigger-change instant to a hover close after switching triggers', async () => {
      const { user, trigger2, popup, instantsWhileEnding } = await renderHoverDetachedTriggers();

      // The ending style lasts only while the exit runs, so the case waits for the start of the exit.
      await nextEvent(popup, 'transitionrun', { action: () => user.unhover(trigger2) });
      expect(popup).toHaveAttribute('data-ending-style');

      expect(instantsWhileEnding).not.toContain('trigger-change');
    });

    it('does not restore the trigger-change instant when a controlled close commits late', async () => {
      // A controlled consumer can accept the close but commit `open={false}`
      // later. That commit goes straight through the prop without passing back
      // through `setOpen`, so a `trigger-change` restored in the meantime would
      // never be cleared and would collapse the exit transition.
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      const instantsWhileEnding: (string | undefined)[] = [];
      // Renders between the close request and its late commit. The restoration
      // has to land in this window, or the test isn't exercising the race.
      const instantsWhileClosePending: (string | undefined)[] = [];
      const openedTriggerIds: (string | undefined)[] = [];
      let closeRequested = false;
      let commitClose = () => {};

      const Test = defineComponent({
        setup() {
          const open = shallowRef(false);
          const activeTrigger = shallowRef<string | null>(null);

          return () => (
            <div style={{ position: 'relative', width: '400px', height: '200px' }}>
              <style>{animationStyles({ positionerMs: LONG_ANIMATION_MS })}</style>

              <Menu.Root
                open={open.value}
                triggerId={activeTrigger.value}
                onOpenChange={(nextOpen: boolean, details: Menu.Root.ChangeEventDetails) => {
                  if (nextOpen) {
                    openedTriggerIds.push(details.trigger?.id);
                    activeTrigger.value = details.trigger?.id ?? null;
                    open.value = true;
                    return;
                  }

                  closeRequested = true;
                  commitClose = () => {
                    open.value = false;
                  };
                }}
              >
                <Menu.Trigger
                  id="trigger-1"
                  openOnHover
                  delay={0}
                  style={{ position: 'absolute', top: '20px', left: '20px' }}
                >
                  Trigger 1
                </Menu.Trigger>
                <Menu.Trigger
                  id="trigger-2"
                  openOnHover
                  delay={0}
                  style={{ position: 'absolute', top: '20px', left: '220px' }}
                >
                  Trigger 2
                </Menu.Trigger>

                <Menu.Portal>
                  <Menu.Positioner data-testid="positioner" class="positioner">
                    <Menu.Popup
                      data-testid="popup"
                      class="popup"
                      v-slots={{
                        render: ({
                          props,
                          state,
                        }: {
                          props: HTMLProps;
                          state: Menu.Popup.State;
                        }) => {
                          if (state.transitionStatus === 'ending') {
                            instantsWhileEnding.push(state.instant);
                          } else if (closeRequested) {
                            instantsWhileClosePending.push(state.instant);
                          }
                          return (
                            <div {...props}>
                              <Menu.Item>Item</Menu.Item>
                            </div>
                          );
                        },
                      }}
                    />
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            </div>
          );
        },
      });

      const { user } = await render(<Test />);

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await user.hover(trigger1);
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).not.toBe(null);
      });

      // Let the first open settle so moving to trigger 2 is a real switch.
      await waitForSettledPosition(screen.getByTestId('positioner'));

      const switchAnimations = await nextAnimationsRead(screen.getByTestId('positioner'), {
        action: () => user.hover(trigger2),
      });
      // Request the close while the switch is still animating.
      await user.unhover(trigger2);
      expect(closeRequested).toBe(true);

      // The switch ends before the late commit.
      for (const animation of switchAnimations) {
        animation.finish();
      }
      await waitFor(() => {
        expect(instantsWhileClosePending).toContain('trigger-change');
      });

      commitClose();
      await waitFor(() => {
        expect(instantsWhileEnding.length).toBeGreaterThan(0);
      });

      expect(openedTriggerIds).toEqual(['trigger-1', 'trigger-2']);
      expect(instantsWhileEnding).not.toContain('trigger-change');
    });

    it('does not restore the trigger-change instant after a hover close has started', async () => {
      const { user, trigger2, popup, switchAnimations } = await renderHoverDetachedTriggers({
        settleTriggerChange: false,
      });
      expect(switchAnimations.length).toBeGreaterThan(0);

      await nextEvent(popup, 'transitionrun', { action: () => user.unhover(trigger2) });

      // The case takes each promise before it ends the animation. A canceled animation gets a new
      // promise that never settles.
      const finished = switchAnimations.map((animation) => animation.finished);
      for (const animation of switchAnimations) {
        animation.finish();
      }
      await Promise.all(finished);
      await flushMicrotasks();

      // Still mid-exit: the stale callback must not have marked it instant and
      // collapsed the transition.
      expect(screen.getByTestId('popup')).toBe(popup);
      expect(popup).toHaveAttribute('data-ending-style');
      expect(popup).not.toHaveAttribute('data-instant');
    });
  });
});
