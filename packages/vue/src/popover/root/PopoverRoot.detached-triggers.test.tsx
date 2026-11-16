import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Fragment, defineComponent, onMounted, shallowRef } from 'vue';
import type { VNodeChild } from 'vue';
import {
  createRenderer,
  detachedTriggersConformanceTests,
  fireEvent,
  flushMicrotasks,
  isJSDOM,
  nextAnimationsRead,
  screen,
  waitFor,
  waitForLaterMillisecond,
  waitForPositioned,
  waitSingleFrame,
} from '#test-utils';
import { PATIENT_CLICK_THRESHOLD } from '../../internals/constants';
import type { HTMLProps } from '../../internals/types';
import * as Popover from '../index.parts';

const DETACHED_WARNING = 'no root that uses this handle is mounted';

async function tick(ms: number) {
  await flushMicrotasks();
  await vi.advanceTimersByTimeAsync(ms);
  await flushMicrotasks();
}

describe('<Popover.Root />', () => {
  const { render } = createRenderer();

  it('opens by trigger from a descendant layout effect on initial mount', async () => {
    const handle = Popover.createHandle();
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const OpenOnMount = defineComponent({
      setup() {
        onMounted(() => {
          handle.open('trigger');
        });
        return () => null;
      },
    });

    await render(() => (
      <Popover.Root handle={handle}>
        <Popover.Trigger id="trigger">Trigger</Popover.Trigger>
        <OpenOnMount />
      </Popover.Root>
    ));

    const detachedWarned = consoleWarn.mock.calls.some(
      ([message]) => typeof message === 'string' && message.includes(DETACHED_WARNING),
    );
    consoleWarn.mockRestore();

    expect(detachedWarned).toBe(false);
    expect(handle.isOpen).toBe(true);
    expect(screen.getByRole('button', { name: 'Trigger' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  detachedTriggersConformanceTests({
    render,
    createHandle: Popover.createHandle,
    Root: Popover.Root,
    Trigger: Popover.Trigger,
    Portal: Popover.Portal,
    Positioner: Popover.Positioner,
    Popup: Popover.Popup,
    Viewport: Popover.Viewport,
    Close: Popover.Close,
    openInteractions: ['click'],
    ariaExpanded: true,
    throwOnMissingTrigger: true,
  });

  describe('does not re-render inactive triggers', () => {
    async function renderPopover({
      rootProps,
      triggerProps,
      popupChildren,
    }: {
      rootProps?: Record<string, unknown>;
      triggerProps?: Record<string, unknown>;
      popupChildren?: () => VNodeChild;
    } = {}) {
      const handle = Popover.createHandle();
      const inactiveTrigger = { renders: 0 };

      const { user } = await render(
        <div>
          <Popover.Trigger handle={handle} id="trigger-1" {...triggerProps}>
            Trigger 1
          </Popover.Trigger>
          <Popover.Trigger handle={handle} id="trigger-2" {...triggerProps}>
            Trigger 2
          </Popover.Trigger>
          <Popover.Trigger
            handle={handle}
            id="trigger-3"
            {...triggerProps}
            v-slots={{
              render: ({ props }: { props: HTMLProps }) => {
                inactiveTrigger.renders += 1;
                return <button {...props}>Trigger 3</button>;
              },
            }}
          />
          <Popover.Root handle={handle} {...rootProps}>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup data-testid="popup">
                  Content
                  {popupChildren?.()}
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </div>,
      );

      inactiveTrigger.renders = 0;
      return {
        user,
        handle,
        inactiveTrigger,
        trigger: screen.getByRole('button', { name: 'Trigger 1' }),
        trigger2: screen.getByRole('button', { name: 'Trigger 2' }),
      };
    }

    async function expectOpenedBy(trigger: HTMLElement) {
      expect(await screen.findByTestId('popup')).not.toBe(null);
      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      });
    }

    function expectClosed(trigger: HTMLElement) {
      expect(screen.queryByTestId('popup')).toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    }

    it('when a click opens and closes the popup', async () => {
      const { user, inactiveTrigger, trigger } = await renderPopover();

      async function openAndClose() {
        await user.click(trigger);
        await expectOpenedBy(trigger);
        await user.click(trigger);
        expectClosed(trigger);
      }

      await openAndClose();
      await openAndClose();

      expect(inactiveTrigger.renders).toBe(0);
    });

    it('when a touch press opens and closes the popup', async () => {
      const { user, inactiveTrigger, trigger } = await renderPopover();

      async function openAndClose() {
        await user.pointer({ keys: '[TouchA]', target: trigger });
        await expectOpenedBy(trigger);
        await user.pointer({ keys: '[TouchA]', target: trigger });
        expectClosed(trigger);
      }

      await openAndClose();
      await openAndClose();

      expect(inactiveTrigger.renders).toBe(0);
    });

    it('when a modal popup closes from Popover.Close', async () => {
      const { user, inactiveTrigger, trigger } = await renderPopover({
        rootProps: { modal: true },
        popupChildren: () => <Popover.Close>Close</Popover.Close>,
      });

      async function openAndClose() {
        await waitForLaterMillisecond(() => user.click(trigger));
        await expectOpenedBy(trigger);
        await user.click(screen.getByRole('button', { name: 'Close' }));
        expectClosed(trigger);
      }

      await openAndClose();
      await openAndClose();

      expect(inactiveTrigger.renders).toBe(0);
    });

    it('when the popup moves to another trigger', async () => {
      const { user, inactiveTrigger, trigger, trigger2 } = await renderPopover();

      await user.click(trigger);
      await expectOpenedBy(trigger);
      await user.click(trigger2);
      await expectOpenedBy(trigger2);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).not.toHaveAttribute('data-pressed');
      expect(trigger2).toHaveAttribute('data-pressed');
      expect(trigger.previousElementSibling).toBe(null);
      expect(trigger2.previousElementSibling).toHaveAttribute('data-vase-ui-focus-guard');
      expect(trigger2.nextElementSibling).toHaveAttribute('data-vase-ui-focus-guard');
      await user.click(trigger2);
      expectClosed(trigger2);

      expect(inactiveTrigger.renders).toBe(0);
    });

    describe('with openOnHover', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('when a hover opens the popup', async () => {
        const { handle, inactiveTrigger, trigger } = await renderPopover({
          triggerProps: { openOnHover: true, delay: 0, closeDelay: 0 },
        });

        async function openAndClose() {
          await fireEvent.mouseEnter(trigger);
          await fireEvent.mouseMove(trigger);
          await flushMicrotasks();
          expect(screen.queryByTestId('popup')).not.toBe(null);
          expect(trigger).toHaveAttribute('aria-expanded', 'true');

          // Covers the patient-click window ending while open.
          await tick(PATIENT_CLICK_THRESHOLD);
          await fireEvent.mouseLeave(trigger);
          handle.close();
          await flushMicrotasks();
          expect(screen.queryByTestId('popup')).toBe(null);
          expect(trigger).toHaveAttribute('aria-expanded', 'false');
        }

        await openAndClose();
        await openAndClose();

        expect(inactiveTrigger.renders).toBe(0);
      });

      it('when a press takes over a hover-opened popup', async () => {
        const { handle, inactiveTrigger, trigger } = await renderPopover({
          triggerProps: { openOnHover: true, delay: 0, closeDelay: 0 },
        });

        await fireEvent.mouseEnter(trigger);
        await fireEvent.mouseMove(trigger);
        await flushMicrotasks();
        expect(screen.queryByTestId('popup')).not.toBe(null);

        // A press inside the patient-click window keeps it open and changes the open reason.
        await fireEvent.click(trigger);
        await flushMicrotasks();
        expect(trigger).toHaveAttribute('data-pressed');

        await fireEvent.mouseLeave(trigger);
        handle.close();
        await flushMicrotasks();
        expect(screen.queryByTestId('popup')).toBe(null);

        expect(inactiveTrigger.renders).toBe(0);
      });
    });
  });

  describe('after a prop-only reopen', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('keeps the popup open when the last hovered trigger is pressed', async () => {
      const handle = Popover.createHandle();
      const open = shallowRef(false);

      const App = defineComponent({
        setup() {
          return () => (
            <div>
              <Popover.Trigger handle={handle} id="trigger-1" openOnHover delay={0}>
                Trigger 1
              </Popover.Trigger>
              <Popover.Trigger handle={handle} id="trigger-2">
                Trigger 2
              </Popover.Trigger>
              <Popover.Root
                handle={handle}
                open={open.value}
                onOpenChange={(nextOpen: boolean) => {
                  open.value = nextOpen;
                }}
              >
                <Popover.Portal>
                  <Popover.Positioner>
                    <Popover.Popup data-testid="popup">Content</Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
            </div>
          );
        },
      });

      await render(<App />);
      const trigger = screen.getByRole('button', { name: 'Trigger 1' });

      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);
      await flushMicrotasks();
      expect(screen.queryByTestId('popup')).not.toBe(null);
      // End the hover's patient-click window so only the close-time reset keeps the click sticky.
      await tick(PATIENT_CLICK_THRESHOLD);

      open.value = false;
      await flushMicrotasks();
      expect(screen.queryByTestId('popup')).toBe(null);

      open.value = true;
      await flushMicrotasks();
      expect(screen.queryByTestId('popup')).not.toBe(null);

      await fireEvent.click(trigger);
      await flushMicrotasks();
      expect(screen.queryByTestId('popup')).not.toBe(null);
    });
  });

  it('dismisses a keyboard-reopened popup on a virtual outside click after a touch session', async () => {
    const handle = Popover.createHandle();
    const { user } = await render(
      <>
        <button>Outside</button>
        <Popover.Trigger handle={handle} id="trigger">
          Trigger
        </Popover.Trigger>
        <Popover.Root handle={handle}>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup data-testid="popup">Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </>,
    );

    const trigger = screen.getByRole('button', { name: 'Trigger' });
    const popup = await waitForLaterMillisecond(async () => {
      await user.click(trigger);
      return screen.findByTestId('popup');
    });

    await fireEvent.pointerDown(popup, { pointerType: 'touch', button: 0 });
    await fireEvent.pointerUp(popup, { pointerType: 'touch', button: 0 });
    await fireEvent.click(popup);
    await user.keyboard('[Escape]');
    expect(screen.queryByTestId('popup')).toBe(null);

    trigger.focus();
    await flushMicrotasks();
    await user.keyboard('[Enter]');
    await screen.findByTestId('popup');

    // Virtual clicks have no pointerdown to replace the previous session's touch type.
    await fireEvent.click(screen.getByRole('button', { name: 'Outside' }), { detail: 0 });
    expect(screen.queryByTestId('popup')).toBe(null);
  });

  describe.skipIf(isJSDOM)('multiple triggers within Root', () => {
    it('returns focus to the active trigger when opening programmatically from body focus', async () => {
      const Test = defineComponent({
        setup() {
          const open = shallowRef(false);
          const activeTrigger = shallowRef<string | null>(null);

          return () => (
            <>
              <Popover.Root
                open={open.value}
                triggerId={activeTrigger.value}
                onOpenChange={(nextOpen: boolean, details: Popover.Root.ChangeEventDetails) => {
                  activeTrigger.value = details.trigger?.id ?? null;
                  open.value = nextOpen;
                }}
              >
                <Popover.Trigger payload={1} id="trigger-1">
                  Trigger 1
                </Popover.Trigger>
                <Popover.Trigger payload={2} id="trigger-2">
                  Trigger 2
                </Popover.Trigger>

                <Popover.Portal>
                  <Popover.Positioner>
                    <Popover.Popup>
                      <span data-testid="content">Content</span>
                      <Popover.Close>Close</Popover.Close>
                    </Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>

              <button
                onMousedown={(event: MouseEvent) => event.preventDefault()}
                onClick={() => {
                  open.value = true;
                  activeTrigger.value = 'trigger-2';
                }}
              >
                Open Trigger 2 without focus
              </button>
            </>
          );
        },
      });

      const { user } = await render(<Test />);

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await waitForLaterMillisecond(() => user.click(trigger1));
      await user.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() => {
        expect(trigger1).toHaveFocus();
      });

      trigger1.blur();
      expect(document.body).toHaveFocus();

      await waitForLaterMillisecond(() =>
        user.click(screen.getByRole('button', { name: 'Open Trigger 2 without focus' })),
      );
      await waitFor(() => {
        expect(screen.getByTestId('content')).toBeVisible();
      });

      await user.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() => {
        expect(trigger2).toHaveFocus();
      });
    });

    it('returns focus to the previous element when the trigger unmounts while open', async () => {
      const Test = defineComponent({
        setup() {
          const open = shallowRef(false);
          const showTrigger = shallowRef(true);

          return () => (
            <>
              <button type="button">Focus fallback</button>

              <Popover.Root
                open={open.value}
                onOpenChange={(nextOpen: boolean) => {
                  if (nextOpen) {
                    showTrigger.value = false;
                  }
                  open.value = nextOpen;
                }}
              >
                {showTrigger.value && (
                  <Popover.Trigger onMousedown={(event: MouseEvent) => event.preventDefault()}>
                    Disappearing trigger
                  </Popover.Trigger>
                )}

                <Popover.Portal>
                  <Popover.Positioner>
                    <Popover.Popup>
                      <span data-testid="content">Content</span>
                      <Popover.Close>Close</Popover.Close>
                    </Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
            </>
          );
        },
      });

      const { user } = await render(<Test />);

      const fallback = screen.getByRole('button', { name: 'Focus fallback' });
      await user.click(fallback);
      expect(fallback).toHaveFocus();

      await waitForLaterMillisecond(() =>
        user.click(screen.getByRole('button', { name: 'Disappearing trigger' })),
      );
      await waitFor(() => {
        expect(screen.getByTestId('content')).toBeVisible();
      });

      await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByTestId('content')).toBe(null);
      expect(fallback).toHaveFocus();
    });
  });

  describe.skipIf(isJSDOM)('multiple detached triggers', () => {
    // The positioner has an animation of 100 s from its mount, and the popup has an exit transition
    // of 100 s. A move to another trigger waits for the animations of the positioner, so it stays
    // pending until a case ends the animation with `finish()`.
    const animationStyle = `
      @keyframes hold {
        from {
          outline-offset: 0;
        }

        to {
          outline-offset: 1px;
        }
      }

      .positioner {
        animation: hold 100s linear;
      }

      .popup {
        opacity: 1;
        transition: opacity 100s linear;
      }

      .popup[data-ending-style] {
        opacity: 0;
      }

      .positioner[data-instant],
      .popup[data-instant] {
        transition: none;
      }
    `;

    type NumberPayload = { payload: number | undefined };

    /**
     * Ends the animation of the positioner, so that the move to the other trigger completes. A
     * move that finds no animation completes at once.
     */
    async function settleTriggerChange() {
      screen
        .getByTestId('positioner')
        .getAnimations()
        .forEach((animation) => animation.finish());
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-instant', 'trigger-change');
      });
    }

    /**
     * Renders two detached hover triggers with an animation on the positioner and an exit
     * transition on the popup, then hands the popover off from trigger 1 to trigger 2 so
     * `instantType` is `trigger-change`.
     *
     * `instantsWhileEnding` records the `instant` state of every closing render,
     * which is the only way to observe a stale value that a later render clears
     * before the DOM can be asserted on. `switchAnimations` are the animations that the move to
     * trigger 2 waits for.
     */
    async function renderHoverDetachedTriggers({
      popupChildren,
      settle = true,
    }: {
      popupChildren?: () => VNodeChild;
      /**
       * Set to `false` to return while the positioner is still animating to the
       * new trigger, so the delayed `trigger-change` restoration is still pending.
       */
      settle?: boolean;
    } = {}) {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      const testPopover = Popover.createHandle<number>();
      const instantsWhileEnding: (string | undefined)[] = [];
      const onOpenChangeComplete = vi.fn();

      const utils = await render(
        <div style={{ position: 'relative', width: '400px', height: '200px' }}>
          <style>{animationStyle}</style>

          <Popover.Trigger
            handle={testPopover}
            payload={1}
            openOnHover
            delay={0}
            style={{ position: 'absolute', top: '20px', left: '20px' }}
          >
            Trigger 1
          </Popover.Trigger>
          <Popover.Trigger
            handle={testPopover}
            payload={2}
            openOnHover
            delay={0}
            style={{ position: 'absolute', top: '20px', left: '220px' }}
          >
            Trigger 2
          </Popover.Trigger>

          <Popover.Root
            handle={testPopover}
            onOpenChangeComplete={onOpenChangeComplete}
            v-slots={{
              default: ({ payload }: NumberPayload) => (
                <Popover.Portal>
                  <Popover.Positioner data-testid="positioner" class="positioner">
                    <Popover.Popup
                      data-testid="popup"
                      class="popup"
                      v-slots={{
                        render: ({
                          props,
                          state,
                        }: {
                          props: HTMLProps;
                          state: Popover.Popup.State;
                        }) => {
                          if (state.transitionStatus === 'ending') {
                            instantsWhileEnding.push(state.instant);
                          }
                          return (
                            <div {...props}>
                              <span data-testid="content">{payload}</span>
                              {popupChildren?.()}
                            </div>
                          );
                        },
                      }}
                    />
                  </Popover.Positioner>
                </Popover.Portal>
              ),
            }}
          />
        </div>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await utils.user.hover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });
      // The root reads the animations of the popup when the popup loses `data-starting-style`, one
      // frame after the open. A switch before that frame removes the attribute and starts an exit.
      // The next frame cancels the exit, and the root reads the animations of the popup again,
      // after the setup. `startExit` would take that read for the read of a close. The end of the
      // open comes after the first read, so the case waits for it before the switch.
      await waitFor(() => {
        expect(onOpenChangeComplete).toHaveBeenCalledWith(true);
      });

      const switchAnimations = await nextAnimationsRead(screen.getByTestId('positioner'), {
        action: () => utils.user.hover(trigger2),
      });
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('2');
      });

      if (settle) {
        await settleTriggerChange();
      }

      // `user.hover` gives the leave event no `relatedTarget`, so the switch to trigger 2 closes
      // the popup and opens it again in one task. The popup thus has the ending status until the
      // next frame, and it renders with that status. Only the close that follows matters.
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

    /**
     * Runs `close` and waits until the root reads the animations of the exit. After the setup,
     * only a close makes the root read the animations of the popup.
     */
    async function startExit(popup: HTMLElement, close: () => unknown) {
      const exitAnimations = await nextAnimationsRead(popup, { action: close });
      expect(exitAnimations.length).toBeGreaterThan(0);
      expect(popup).toHaveAttribute('data-ending-style');
    }

    it('does not apply the trigger-change instant to a hover close after switching triggers', async () => {
      const { user, trigger2, popup, instantsWhileEnding } = await renderHoverDetachedTriggers();

      await startExit(popup, () => user.unhover(trigger2));

      expect(instantsWhileEnding).not.toContain('trigger-change');
    });

    it('does not apply the trigger-change instant to a non-hover close after switching triggers', async () => {
      const { popup, instantsWhileEnding } = await waitForLaterMillisecond(() =>
        renderHoverDetachedTriggers({
          popupChildren: () => <Popover.Close>Close</Popover.Close>,
        }),
      );

      await startExit(popup, () => fireEvent.click(screen.getByRole('button', { name: 'Close' })));

      expect(instantsWhileEnding).not.toContain('trigger-change');
    });

    it('does not apply the trigger-change instant after switching back to the original trigger', async () => {
      const { user, trigger1, instantsWhileEnding } = await renderHoverDetachedTriggers();

      await user.hover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });
      await settleTriggerChange();
      instantsWhileEnding.length = 0;

      await startExit(screen.getByTestId('popup'), () => user.unhover(trigger1));

      expect(instantsWhileEnding).not.toContain('trigger-change');
    });

    it('does not restore the trigger-change instant after a reopen on the same trigger', async () => {
      // Leaving and returning mid-exit keeps the positioner mounted and the
      // trigger unchanged, so nothing re-runs the effect to cancel the pending
      // switch callback. A slow switch keeps it pending across the reopen.
      const { user, trigger2, switchAnimations } = await renderHoverDetachedTriggers({
        settle: false,
      });
      expect(switchAnimations.length).toBeGreaterThan(0);

      await startExit(screen.getByTestId('popup'), () => user.unhover(trigger2));

      await user.hover(trigger2);
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
      });

      const reopenedPopup = screen.getByTestId('popup');
      await waitSingleFrame();
      switchAnimations.forEach((animation) => animation.finish());
      await waitSingleFrame();
      await flushMicrotasks();

      expect(reopenedPopup).not.toHaveAttribute('data-instant');
    });

    it('does not apply the trigger-change instant to a prop-driven close after a switch', async () => {
      // A controlled consumer can switch triggers and close entirely through
      // props, so neither transition passes through `setOpen`.
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      const endingInstants: (string | undefined)[] = [];
      const open = shallowRef(false);
      const triggerId = shallowRef<string | null>(null);
      const onOpenChangeComplete = vi.fn();

      const Test = defineComponent({
        setup() {
          return () => (
            <div style={{ position: 'relative', width: '400px', height: '240px' }}>
              <style>{animationStyle}</style>

              <Popover.Root
                open={open.value}
                triggerId={triggerId.value}
                onOpenChange={(nextOpen: boolean, details: Popover.Root.ChangeEventDetails) => {
                  if (nextOpen) {
                    triggerId.value = details.trigger?.id ?? null;
                  }
                  open.value = nextOpen;
                }}
                onOpenChangeComplete={onOpenChangeComplete}
              >
                <Popover.Trigger
                  id="t1"
                  style={{ position: 'absolute', top: '80px', left: '20px' }}
                >
                  Trigger 1
                </Popover.Trigger>
                <Popover.Trigger
                  id="t2"
                  style={{ position: 'absolute', top: '80px', left: '220px' }}
                >
                  Trigger 2
                </Popover.Trigger>

                <Popover.Portal>
                  <Popover.Positioner data-testid="positioner" class="positioner">
                    <Popover.Popup
                      data-testid="popup"
                      class="popup"
                      v-slots={{
                        render: ({
                          props,
                          state,
                        }: {
                          props: HTMLProps;
                          state: Popover.Popup.State;
                        }) => {
                          if (state.transitionStatus === 'ending') {
                            endingInstants.push(state.instant);
                          }
                          return <div {...props}>Content</div>;
                        },
                      }}
                    />
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
            </div>
          );
        },
      });

      const { user } = await render(<Test />);

      await user.click(screen.getByRole('button', { name: 'Trigger 1' }));
      await waitFor(() => {
        expect(screen.getByTestId('popup')).not.toBe(null);
      });
      await waitForPositioned(screen.getByTestId('positioner'));
      // The root reads the animations of the popup in a frame after the open, to report the end of
      // the open. The wait for the read of the close must start after that read.
      await waitFor(() => {
        expect(onOpenChangeComplete).toHaveBeenCalledWith(true);
      });

      triggerId.value = 't2';
      await flushMicrotasks();
      await settleTriggerChange();

      endingInstants.length = 0;
      const popup = screen.getByTestId('popup');
      const exitAnimations = nextAnimationsRead(popup, {
        action: () => {
          open.value = false;
        },
      });
      await waitFor(() => {
        expect(endingInstants.length).toBeGreaterThan(0);
      });

      expect(endingInstants).not.toContain('trigger-change');

      // Reopening on the same trigger, again purely through props, must not
      // inherit the `trigger-change` the earlier switch had stored.
      (await exitAnimations).forEach((animation) => animation.finish());
      await waitFor(() => {
        expect(popup).not.toBeInTheDocument();
      });
      expect(screen.queryByTestId('popup')).toBe(null);

      open.value = true;
      await flushMicrotasks();
      await waitFor(() => {
        expect(screen.getByTestId('popup')).not.toBe(null);
      });

      expect(screen.getByTestId('popup')).not.toHaveAttribute('data-instant');
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
      const closedTriggerIds: (string | undefined)[] = [];
      const open = shallowRef(false);
      const activeTrigger = shallowRef<string | null>(null);
      let closeRequested = false;

      const Test = defineComponent({
        setup() {
          return () => (
            <div style={{ position: 'relative', width: '400px', height: '200px' }}>
              <style>{animationStyle}</style>

              <Popover.Root
                open={open.value}
                triggerId={activeTrigger.value}
                onOpenChange={(nextOpen: boolean, details: Popover.Root.ChangeEventDetails) => {
                  if (nextOpen) {
                    openedTriggerIds.push(details.trigger?.id);
                    activeTrigger.value = details.trigger?.id ?? null;
                    open.value = true;
                    return;
                  }

                  // The consumer commits the close later, after the case ends the switch.
                  closeRequested = true;
                  closedTriggerIds.push(details.trigger?.id);
                }}
              >
                <Popover.Trigger
                  payload={1}
                  id="trigger-1"
                  openOnHover
                  delay={0}
                  style={{ position: 'absolute', top: '20px', left: '20px' }}
                >
                  Trigger 1
                </Popover.Trigger>
                <Popover.Trigger
                  payload={2}
                  id="trigger-2"
                  openOnHover
                  delay={0}
                  style={{ position: 'absolute', top: '20px', left: '220px' }}
                >
                  Trigger 2
                </Popover.Trigger>

                <Popover.Portal>
                  <Popover.Positioner data-testid="positioner" class="positioner">
                    <Popover.Popup
                      data-testid="popup"
                      class="popup"
                      v-slots={{
                        render: ({
                          props,
                          state,
                        }: {
                          props: HTMLProps;
                          state: Popover.Popup.State;
                        }) => {
                          if (state.transitionStatus === 'ending') {
                            instantsWhileEnding.push(state.instant);
                          } else if (closeRequested) {
                            instantsWhileClosePending.push(state.instant);
                          }
                          return <div {...props}>Content</div>;
                        },
                      }}
                    />
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
            </div>
          );
        },
      });

      const { user } = await render(<Test />);

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await user.hover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('popup')).not.toBe(null);
      });
      await waitForPositioned(screen.getByTestId('positioner'));

      const switchAnimations = await nextAnimationsRead(screen.getByTestId('positioner'), {
        action: () => user.hover(trigger2),
      });
      await waitFor(() => {
        expect(openedTriggerIds).toEqual(['trigger-1', 'trigger-2']);
      });
      // Request the close while the switch is still animating.
      await user.unhover(trigger2);
      await waitFor(() => {
        expect(closedTriggerIds).toContain('trigger-2');
      });

      // The switch ends before the consumer commits the close.
      switchAnimations.forEach((animation) => animation.finish());
      await waitFor(() => {
        expect(instantsWhileClosePending).toContain('trigger-change');
      });

      open.value = false;
      await flushMicrotasks();
      await waitFor(() => {
        expect(instantsWhileEnding.length).toBeGreaterThan(0);
      });

      expect(instantsWhileEnding).not.toContain('trigger-change');
    });

    it('does not restore the trigger-change instant after a hover close has started', async () => {
      const { user, trigger2, popup, switchAnimations } = await renderHoverDetachedTriggers({
        settle: false,
      });
      expect(switchAnimations.length).toBeGreaterThan(0);

      await startExit(popup, () => user.unhover(trigger2));
      await waitSingleFrame();

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

    it('renders focus guards around the active detached trigger and reports it on close', async () => {
      const testPopover = Popover.createHandle();
      const onOpenChange = vi.fn();
      const { user } = await render(
        <>
          <Popover.Trigger handle={testPopover} id="trigger-1">
            Trigger 1
          </Popover.Trigger>
          <Popover.Trigger handle={testPopover} id="trigger-2">
            Trigger 2
          </Popover.Trigger>
          <span>After</span>
          <Popover.Root handle={testPopover} onOpenChange={onOpenChange}>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup>
                  Content
                  <Popover.Close>Close</Popover.Close>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </>,
      );

      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await waitForLaterMillisecond(() => user.click(trigger2));
      await waitFor(() => {
        expect(screen.getByText('Content')).toBeVisible();
      });
      expect(trigger2.previousElementSibling).toHaveAttribute('data-vase-ui-focus-guard');
      expect(trigger2.nextElementSibling).toHaveAttribute('data-vase-ui-focus-guard');

      await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByText('Content')).toBe(null);
      expect(trigger2.previousElementSibling).not.toHaveAttribute('data-vase-ui-focus-guard');
      expect(trigger2.nextElementSibling).not.toHaveAttribute('data-vase-ui-focus-guard');
      // Closing with Popover.Close reports the active trigger.
      expect(onOpenChange).toHaveBeenCalledTimes(2);
      expect(onOpenChange.mock.calls[1]![0]).toBe(false);
      expect(onOpenChange.mock.calls[1]![1].trigger).toBe(trigger2);
    });

    it('keeps positioning correct when conditional triggers unmount and the tree remounts', async () => {
      const testPopover = Popover.createHandle();

      const Test = defineComponent({
        setup() {
          const key = shallowRef(1);
          const showErrorDemo = shallowRef(true);

          return () => (
            <Fragment key={key.value}>
              <button
                onClick={() => {
                  showErrorDemo.value = !showErrorDemo.value;
                  key.value += 1;
                }}
              >
                Toggle
              </button>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '48px',
                  margin: '50px',
                }}
              >
                <Popover.Trigger handle={testPopover} id="trigger-0">
                  Trigger 0
                </Popover.Trigger>
                {showErrorDemo.value && (
                  <Popover.Trigger handle={testPopover} id="trigger-1">
                    Trigger 1
                  </Popover.Trigger>
                )}
              </div>

              <Popover.Root handle={testPopover} triggerId="trigger-0" open>
                <Popover.Portal>
                  <Popover.Positioner data-testid="positioner" sideOffset={4} align="start">
                    <Popover.Popup>Content</Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
            </Fragment>
          );
        },
      });

      const { user } = await render(<Test />);

      const trigger0 = screen.getByRole('button', { name: 'Trigger 0' });
      await waitFor(() => {
        expect(
          Math.abs(
            screen.getByTestId('positioner').getBoundingClientRect().left -
              trigger0.getBoundingClientRect().left,
          ),
        ).toBeLessThanOrEqual(1);
      });

      await user.click(screen.getByRole('button', { name: 'Toggle' }));
      const trigger0After = screen.getByRole('button', { name: 'Trigger 0' });
      await waitFor(() => {
        expect(
          Math.abs(
            screen.getByTestId('positioner').getBoundingClientRect().left -
              trigger0After.getBoundingClientRect().left,
          ),
        ).toBeLessThanOrEqual(1);
      });
    });
  });

  // The outside press closes the popover before the click listener of the outside button runs.
  // The listener then opens the popover again.
  describe('an outside button that opens the open popover', () => {
    const actions = ['move', 'same trigger', 'handle.open'] as const;
    const rows = actions.flatMap((action) =>
      [false, true].flatMap((child) =>
        [false, true].map((initialFocus) => ({
          name: `${action} (${child ? 'child' : 'text'}, initialFocus ${initialFocus})`,
          action,
          child,
          initialFocus,
        })),
      ),
    );

    it.each(rows)('keeps it open: $name', async ({ action, child, initialFocus }) => {
      const handle = Popover.createHandle<number>();
      const open = shallowRef(false);
      const triggerId = shallowRef<string | null>(null);
      const target = action === 'same trigger' ? 1 : 2;

      function openFor(id: string) {
        if (action === 'handle.open') {
          handle.open(id);
        } else {
          open.value = true;
          triggerId.value = id;
        }
      }

      const Test = defineComponent(() => () => (
        <div style={{ margin: '50px' }}>
          <Popover.Trigger handle={handle} id="trigger-1" payload={1}>
            Trigger 1
          </Popover.Trigger>
          <Popover.Trigger
            handle={handle}
            id="trigger-2"
            payload={2}
            style={{ marginLeft: '200px' }}
          >
            Trigger 2
          </Popover.Trigger>
          <Popover.Root
            handle={handle}
            {...(action === 'handle.open'
              ? {}
              : {
                  open: open.value,
                  triggerId: triggerId.value,
                  onOpenChange: (nextOpen: boolean, details: Popover.Root.ChangeEventDetails) => {
                    triggerId.value = details.trigger?.id ?? null;
                    open.value = nextOpen;
                  },
                })}
          >
            {{
              default: ({ payload }: { payload: number | undefined }) => (
                <Popover.Portal>
                  <Popover.Positioner data-testid="positioner" side="bottom" align="start">
                    <Popover.Popup data-testid="popup" initialFocus={initialFocus}>
                      <span data-testid="content">{String(payload)}</span>
                      <button type="button">Inside</button>
                    </Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              ),
            }}
          </Popover.Root>
          <button type="button" onClick={() => openFor('trigger-1')}>
            Open Trigger 1
          </button>
          <button
            type="button"
            style={{ padding: '0' }}
            onClick={() => openFor(`trigger-${target}`)}
          >
            {child ? (
              <span data-testid="child" style={{ display: 'inline-block', padding: '4px' }}>
                Open target
              </span>
            ) : (
              'Open target'
            )}
          </button>
        </div>
      ));

      const { user } = await render(<Test />);
      await user.click(screen.getByRole('button', { name: 'Open Trigger 1' }));
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });
      // A person presses the next button after the frame of the initial focus.
      if (initialFocus) {
        await waitFor(() => {
          expect(screen.getByTestId('popup').contains(document.activeElement)).toBe(true);
        });
      } else {
        await waitSingleFrame();
      }

      await user.click(
        child ? screen.getByTestId('child') : screen.getByRole('button', { name: 'Open target' }),
      );

      const trigger = screen.getByRole('button', { name: `Trigger ${target}` });
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe(String(target));
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await waitFor(() => {
        expect(
          Math.abs(
            screen.getByTestId('positioner').getBoundingClientRect().left -
              trigger.getBoundingClientRect().left,
          ),
        ).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('VUE-75: an outside button that toggles the popover', () => {
    it.each([
      { name: 'opens it again: v-model', withHandle: false, cancel: false },
      { name: 'opens it again: handle', withHandle: true, cancel: false },
      { name: 'closes it with details.cancel(): v-model', withHandle: false, cancel: true },
      { name: 'closes it with details.cancel(): handle', withHandle: true, cancel: true },
    ])('$name', async ({ withHandle, cancel }) => {
      const handle = Popover.createHandle();
      const open = shallowRef(false);
      const isOpen = () => (withHandle ? handle.isOpen : open.value);

      function toggle() {
        if (!withHandle) {
          open.value = !open.value;
        } else if (handle.isOpen) {
          handle.close();
        } else {
          handle.open('trigger');
        }
      }

      const Test = defineComponent(() => () => (
        <div>
          <Popover.Trigger handle={handle} id="trigger">
            Trigger
          </Popover.Trigger>
          <Popover.Root
            handle={handle}
            {...(withHandle
              ? {}
              : {
                  open: open.value,
                  triggerId: 'trigger',
                  'onUpdate:open': (value: boolean) => {
                    open.value = value;
                  },
                })}
            onOpenChange={(_open: boolean, details: Popover.Root.ChangeEventDetails) => {
              if (cancel && details.event.target === toggleButton()) {
                details.cancel();
              }
            }}
          >
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup data-testid="popup" initialFocus={false}>
                  Content
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
          <button type="button" onClick={toggle}>
            Toggle
          </button>
        </div>
      ));
      const toggleButton = () => screen.getByRole('button', { name: 'Toggle' });

      const { user } = await render(<Test />);
      await user.click(toggleButton());
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toBeVisible();
      });

      await user.click(toggleButton());

      expect(isOpen()).toBe(!cancel);
      if (cancel) {
        expect(screen.queryByTestId('popup')).toBe(null);
      } else {
        await waitFor(() => {
          expect(screen.getByTestId('popup')).toBeVisible();
        });
      }
    });
  });
});
