import { defineComponent, shallowRef } from 'vue';
import type { CSSProperties, VNode } from 'vue';
import type { UserEvent } from '@testing-library/user-event';
import { expect, vi, describe, it, afterEach, beforeEach, onTestFinished } from 'vitest';
import { isInaccessible, screen, waitFor } from '@testing-library/dom';
import { ownerDocument } from '../src/common/owner';
import { activeElement } from '../src/common/shadowDom';
import { isJSDOM } from '../src/common/testUtils';
import { REASONS } from '../src/internals/reasons';
import type { createRenderer } from './createRenderer';
import { fireEvent } from './fireEvent';
import { flushMicrotasks } from './flushMicrotasks';
import { enterWithMouse } from './pointer';
import { randomStringValue } from './randomStringValue';
import { wait } from './wait';

export function popupConformanceTests(config: PopupTestConfig) {
  const {
    createComponent,
    triggerMouseAction,
    render,
    expectedPopupRole,
    expectedAriaHasPopupValue = expectedPopupRole,
    alwaysMounted,
    combobox = false,
    exitAnimation = true,
    openReason = triggerMouseAction === 'click' ? REASONS.triggerPress : REASONS.triggerHover,
  } = config;

  const prepareComponent = (props: TestedComponentProps) => {
    return createComponent({
      ...props,
      trigger: {
        'data-testid': 'trigger',
        // Hover-opened popups open right away, so the tests don't depend on timers. The trigger
        // ignores the real pointer of the browser, which can rest on it and open the popup.
        ...(triggerMouseAction === 'hover' ? { delay: 0, style: { pointerEvents: 'none' } } : {}),
        ...props.trigger,
      },
      popup: {
        'data-testid': 'popup',
        ...props.popup,
      },
    });
  };

  // The portal renders the popup in the flush after the mount.
  const renderPopup = async (element: VNode | (() => VNode)) => {
    const result = await render(element);
    await flushMicrotasks();
    return result;
  };

  const openWithTrigger = async (user: UserEvent) => {
    const trigger = getTrigger();
    if (triggerMouseAction === 'click') {
      await user.click(trigger);
    } else {
      await enterWithMouse(trigger);
      await flushMicrotasks();
    }
  };

  // Popups that stay mounted after opening are hidden instead of removed when they close.
  const expectPopupClosed = () => {
    if (alwaysMounted) {
      expect(isInaccessible(getPopup()!)).toBe(true);
    } else {
      expect(getPopup()).toBe(null);
    }
  };

  describe('Popup conformance', () => {
    describe('IME dismissal', () => {
      it('dismisses after a composition is dropped without compositionend', async () => {
        const handleOpenChange = vi.fn();
        const { user } = await renderPopup(
          prepareComponent({ root: { defaultOpen: true, onOpenChange: handleOpenChange } }),
        );
        const popup = getPopup()!;
        expect(popup).toBeVisible();

        await fireEvent.compositionStart(popup);
        await user.keyboard('[Escape]');

        await waitFor(expectPopupClosed);
        expect(handleOpenChange).toHaveBeenCalledWith(
          false,
          expect.objectContaining({ reason: REASONS.escapeKey }),
        );
      });

      it.each([
        { name: 'isComposing', isComposing: true, keyCode: 27 },
        { name: 'keyCode 229', isComposing: false, keyCode: 229 },
      ])('preserves the popup for an IME Escape identified by $name', async (event) => {
        const handleOpenChange = vi.fn();
        await renderPopup(
          prepareComponent({ root: { defaultOpen: true, onOpenChange: handleOpenChange } }),
        );
        const popup = getPopup()!;
        expect(popup).toBeVisible();

        await fireEvent.keyDown(activeElement(ownerDocument(popup))!, {
          key: 'Escape',
          isComposing: event.isComposing,
          keyCode: event.keyCode,
        });
        await flushMicrotasks();

        expect(popup).toBeVisible();
        expect(handleOpenChange).not.toHaveBeenCalled();
      });
    });

    describe('controlled mode', () => {
      it('opens the popup with the `open` prop', async () => {
        const { rerender } = await renderPopup(prepareComponent({ root: { open: false } }));
        expect(getPopup()).toBe(null);

        await rerender(prepareComponent({ root: { open: true } }));
        await flushMicrotasks();
        expect(getPopup()).not.toBe(null);
      });

      it('reports every close request while `open={true}` keeps the popup open', async () => {
        const handleOpenChange = vi.fn();
        const { user } = await renderPopup(
          prepareComponent({ root: { open: true, onOpenChange: handleOpenChange } }),
        );

        await user.keyboard('[Escape]');
        await flushMicrotasks();
        expect(getPopup()).toBeVisible();
        await user.keyboard('[Escape]');

        await waitFor(() => {
          expect(handleOpenChange).toHaveBeenCalledTimes(2);
        });
        expect(handleOpenChange).toHaveBeenNthCalledWith(
          2,
          false,
          expect.objectContaining({ reason: REASONS.escapeKey }),
        );
      });
    });

    describe('prop: defaultOpen', () => {
      it('opens initially and remains uncontrolled', async () => {
        const { user } = await renderPopup(prepareComponent({ root: { defaultOpen: true } }));
        expect(getPopup()).toBeVisible();

        await user.keyboard('[Escape]');
        await waitFor(expectPopupClosed);
      });

      it('is ignored when `open={false}` is passed', async () => {
        await renderPopup(prepareComponent({ root: { defaultOpen: true, open: false } }));
        expect(getPopup()).toBe(null);
      });

      it('is ignored when `open={true}` is passed, so Escape cannot close', async () => {
        const { user } = await renderPopup(
          prepareComponent({ root: { defaultOpen: true, open: true } }),
        );
        expect(getPopup()).toBeVisible();

        await user.keyboard('[Escape]');
        await flushMicrotasks();
        expect(getPopup()).toBeVisible();
      });
    });

    describe('prop: onOpenChange', () => {
      it('is called with the new open state and the change details', async () => {
        const handleOpenChange = vi.fn();
        const { user } = await renderPopup(
          prepareComponent({ root: { onOpenChange: handleOpenChange } }),
        );
        expect(handleOpenChange).not.toHaveBeenCalled();

        await openWithTrigger(user);
        await waitFor(() => {
          expect(handleOpenChange).toHaveBeenCalledTimes(1);
        });
        await waitFor(() => {
          expect(getPopup()).toBeVisible();
        });
        expect(handleOpenChange).toHaveBeenCalledTimes(1);
        expect(handleOpenChange).toHaveBeenNthCalledWith(
          1,
          true,
          expect.objectContaining({ reason: openReason, trigger: getTrigger() }),
        );

        await user.keyboard('[Escape]');
        await waitFor(expectPopupClosed);
        expect(handleOpenChange).toHaveBeenCalledTimes(2);
        expect(handleOpenChange).toHaveBeenNthCalledWith(
          2,
          false,
          expect.objectContaining({ reason: REASONS.escapeKey, trigger: getTrigger() }),
        );
      });

      it('keeps the popup closed when the open change is canceled', async () => {
        const handleOpenChange = vi.fn(
          (nextOpen: boolean, eventDetails: OpenChangeEventDetails) => {
            if (nextOpen) {
              eventDetails.cancel();
            }
          },
        );
        const { user } = await renderPopup(
          prepareComponent({ root: { onOpenChange: handleOpenChange } }),
        );

        await openWithTrigger(user);
        await waitFor(() => {
          expect(handleOpenChange).toHaveBeenCalledTimes(1);
        });
        await flushMicrotasks();

        // The open request was made, so a missing popup proves `cancel()` prevented it.
        expect(handleOpenChange).toHaveBeenCalledTimes(1);
        expect(handleOpenChange).toHaveBeenNthCalledWith(
          1,
          true,
          expect.objectContaining({ reason: openReason }),
        );
        expectPopupClosed();
        expect(getTrigger()).not.toHaveAttribute('data-popup-open');
      });

      it('is not called when the `close` action is called while closed', async () => {
        const handleOpenChange = vi.fn();
        const actions = createActionsRef();
        await renderPopup(() =>
          prepareComponent({ root: { ref: actions.ref, onOpenChange: handleOpenChange } }),
        );

        actions.current!.close();
        await flushMicrotasks();

        expect(handleOpenChange).not.toHaveBeenCalled();
        expect(getTrigger()).not.toHaveAttribute('data-popup-open');
      });

      it('is not called when the `close` action is called after the `open` prop opened and closed the popup', async () => {
        const handleOpenChange = vi.fn();
        const actions = createActionsRef();
        const renderRoot = (open: boolean) => () =>
          prepareComponent({ root: { ref: actions.ref, onOpenChange: handleOpenChange, open } });
        const { user, rerender } = await renderPopup(renderRoot(false));

        // The parent ignores this open, so it stays recorded as a pending request until the prop
        // opens and closes the popup.
        await openWithTrigger(user);
        await waitFor(() => {
          expect(handleOpenChange).toHaveBeenCalledWith(true, expect.anything());
        });
        await rerender(renderRoot(true));
        await rerender(renderRoot(false));
        await waitFor(expectPopupClosed);
        handleOpenChange.mockClear();

        actions.current!.close();
        await flushMicrotasks();

        expect(handleOpenChange).not.toHaveBeenCalled();
        expect(getTrigger()).not.toHaveAttribute('data-popup-open');
      });

      it('is called when the `close` action is called while open', async () => {
        const handleOpenChange = vi.fn();
        const actions = createActionsRef();
        await renderPopup(() =>
          prepareComponent({
            root: { ref: actions.ref, defaultOpen: true, onOpenChange: handleOpenChange },
          }),
        );
        expect(getPopup()).toBeVisible();

        actions.current!.close();
        await flushMicrotasks();

        expect(handleOpenChange).toHaveBeenCalledTimes(1);
        expect(handleOpenChange).toHaveBeenNthCalledWith(
          1,
          false,
          expect.objectContaining({ reason: REASONS.imperativeAction }),
        );
        await waitFor(expectPopupClosed);
      });

      if (triggerMouseAction === 'hover') {
        it('cancels a pending hover open when the `close` action is called', async () => {
          const handleOpenChange = vi.fn();
          const actions = createActionsRef();
          await renderPopup(() =>
            prepareComponent({
              root: { ref: actions.ref, onOpenChange: handleOpenChange },
              trigger: { delay: 100 },
            }),
          );

          await enterWithMouse(getTrigger());
          actions.current!.close();
          await wait(200);
          await flushMicrotasks();

          expect(handleOpenChange).not.toHaveBeenCalled();
          expect(getPopup()).toBe(null);
        });

        it('cancels a pending hover open when the `close` action is called while the popup is still mounted', async () => {
          const handleOpenChange = vi.fn(
            (nextOpen: boolean, eventDetails: OpenChangeEventDetails) => {
              if (!nextOpen) {
                eventDetails.preventUnmountOnClose();
              }
            },
          );
          const actions = createActionsRef();
          const { user } = await renderPopup(() =>
            prepareComponent({
              root: { ref: actions.ref, defaultOpen: true, onOpenChange: handleOpenChange },
              trigger: { delay: 100 },
            }),
          );

          await user.keyboard('[Escape]');
          await flushMicrotasks();
          expect(getPopup()).not.toBe(null);
          expect(getPopup()).not.toHaveAttribute('data-open');
          handleOpenChange.mockClear();

          await enterWithMouse(getTrigger());
          actions.current!.close();
          await wait(200);
          await flushMicrotasks();

          expect(handleOpenChange).not.toHaveBeenCalled();
          expect(getPopup()).not.toHaveAttribute('data-open');
        });

        it('reopens a popup that is still mounted once the hover delay ends without a `close` action', async () => {
          const handleOpenChange = vi.fn(
            (nextOpen: boolean, eventDetails: OpenChangeEventDetails) => {
              if (!nextOpen) {
                eventDetails.preventUnmountOnClose();
              }
            },
          );
          const { user } = await renderPopup(
            prepareComponent({
              root: { defaultOpen: true, onOpenChange: handleOpenChange },
              trigger: { delay: 100 },
            }),
          );

          await user.keyboard('[Escape]');
          await flushMicrotasks();
          expect(getPopup()).not.toBe(null);
          expect(getPopup()).not.toHaveAttribute('data-open');
          handleOpenChange.mockClear();

          await enterWithMouse(getTrigger());
          await wait(200);
          await flushMicrotasks();

          expect(handleOpenChange).toHaveBeenCalledWith(true, expect.anything());
          expect(getPopup()).toHaveAttribute('data-open');
        });

        it('is not called when the pointer leaves the trigger before the hover delay ends', async () => {
          const handleOpenChange = vi.fn();
          await renderPopup(
            prepareComponent({
              root: { onOpenChange: handleOpenChange },
              trigger: { delay: 100 },
            }),
          );
          const trigger = getTrigger();

          await enterWithMouse(trigger);
          await fireEvent.mouseLeave(trigger);
          await wait(200);
          await flushMicrotasks();

          expect(handleOpenChange).not.toHaveBeenCalled();
          expect(getPopup()).toBe(null);
        });

        it('opens once the hover delay ends without a `close` action', async () => {
          const handleOpenChange = vi.fn();
          await renderPopup(
            prepareComponent({
              root: { onOpenChange: handleOpenChange },
              trigger: { delay: 100 },
            }),
          );

          await enterWithMouse(getTrigger());
          await wait(200);
          await flushMicrotasks();

          expect(handleOpenChange).toHaveBeenCalledWith(true, expect.anything());
          expect(getPopup()).not.toBe(null);
        });
      }

      it('closes normally after a canceled close that asked to keep the popup mounted', async () => {
        let closeCount = 0;
        const handleOpenChange = vi.fn(
          (nextOpen: boolean, eventDetails: OpenChangeEventDetails) => {
            if (!nextOpen) {
              closeCount += 1;
              if (closeCount === 1) {
                eventDetails.preventUnmountOnClose();
                eventDetails.cancel();
              }
            }
          },
        );
        const handleOpenChangeComplete = vi.fn();
        const { user } = await renderPopup(
          prepareComponent({
            root: {
              defaultOpen: true,
              onOpenChange: handleOpenChange,
              onOpenChangeComplete: handleOpenChangeComplete,
            },
          }),
        );

        await user.keyboard('[Escape]');
        await flushMicrotasks();
        expect(getPopup()).toBeVisible();

        await user.keyboard('[Escape]');
        await waitFor(() => {
          expect(closeCount).toBe(2);
        });
        await waitFor(expectPopupClosed);
        // A popup kept mounted doesn't finish closing until the `unmount` action is called.
        await waitFor(() => {
          expect(handleOpenChangeComplete).toHaveBeenCalledWith(false);
        });
      });

      it.each([
        { name: 'one close', closes: 1, synchronous: false },
        { name: 'a second close during the wait', closes: 2, synchronous: false },
        { name: 'a synchronous request and a second close', closes: 2, synchronous: true },
      ])(
        'keeps a controlled popup from finishing its close when it prevents unmounting after an await, with $name',
        async ({ closes, synchronous }) => {
          const onOpenChangeComplete = vi.fn();
          const handleClose = vi.fn();

          const App = defineComponent({
            setup() {
              const open = shallowRef(true);
              let isBusy = false;
              return () =>
                prepareComponent({
                  root: {
                    open: open.value,
                    onOpenChangeComplete,
                    onOpenChange: async (nextOpen, eventDetails) => {
                      if (nextOpen) {
                        open.value = true;
                        return;
                      }
                      handleClose();
                      // A close that arrives while the first one waits is ignored.
                      if (isBusy) {
                        return;
                      }
                      isBusy = true;
                      if (synchronous) {
                        eventDetails.preventUnmountOnClose();
                      }
                      await wait(50);
                      if (!synchronous) {
                        eventDetails.preventUnmountOnClose();
                      }
                      open.value = false;
                    },
                  },
                });
            },
          });

          const { user } = await renderPopup(<App />);
          expect(getPopup()).toBeVisible();

          await user.keyboard('[Escape]');
          if (closes === 2) {
            await user.keyboard('[Escape]');
          }
          expect(handleClose).toHaveBeenCalledTimes(closes);
          // The popup stays mounted, so the attribute of its closed state stays too.
          await waitFor(() => {
            expect(getPopup()).toHaveAttribute('data-closed');
          });
          expect(getTrigger()).not.toHaveAttribute('data-popup-open');
          await wait(100);
          await flushMicrotasks();

          expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);
          expect(getPopup()).not.toBe(null);
        },
      );
    });

    if (expectedPopupRole || triggerMouseAction === 'click') {
      describe('ARIA attributes', () => {
        if (expectedPopupRole) {
          it(`has the ${expectedPopupRole} role on the popup`, async () => {
            await renderPopup(prepareComponent({ root: { open: true } }));
            expect(getPopup()).toHaveAttribute('role', expectedPopupRole);
          });
        }

        if (triggerMouseAction === 'click') {
          it('has the `aria-controls` attribute on the trigger', async () => {
            await renderPopup(prepareComponent({ root: { open: true } }));
            const trigger = getTrigger();
            const popup = getPopup();
            expect(trigger).toHaveAttribute('aria-controls', popup?.id);
          });

          it('opens on trigger click and sets `aria-expanded` on the trigger', async () => {
            const { user } = await renderPopup(prepareComponent({}));
            const trigger = getTrigger();
            expect(getPopup()).toBe(null);
            expect(trigger).toHaveAttribute('aria-expanded', 'false');
            await user.click(trigger);
            // A combobox popup is the listbox itself; other popups mark the open state.
            const [openAttribute, openValue] = combobox ? ['role', 'listbox'] : ['data-open', ''];
            await waitFor(() => {
              expect(getPopup()).toHaveAttribute(openAttribute, openValue);
            });
            expect(trigger).toHaveAttribute('aria-expanded', 'true');
          });

          if (expectedAriaHasPopupValue) {
            it('has the `aria-haspopup` attribute on the trigger', async () => {
              const { rerender } = await renderPopup(prepareComponent({ root: { open: false } }));
              expect(getTrigger()).toHaveAttribute('aria-haspopup', expectedAriaHasPopupValue);

              await rerender(prepareComponent({ root: { open: true } }));
              await flushMicrotasks();
              expect(getTrigger()).toHaveAttribute('aria-haspopup', expectedAriaHasPopupValue);
            });
          }

          it('allows a custom `id` prop', async () => {
            await renderPopup(prepareComponent({ root: { open: true }, popup: { id: 'TestId' } }));
            expect(getPopup()).toHaveAttribute('id', 'TestId');
            expect(getTrigger()).toHaveAttribute('aria-controls', 'TestId');
          });
        }
      });
    }

    describe('prop: onOpenChangeComplete without animations', () => {
      it('is called on open in the commit that mounts the popup', async () => {
        // Vue has no `Profiler`. A `MutationObserver` gets one call for the DOM changes of one
        // Vue flush, after the flush. The portal puts the popup in the body.
        let commits = 0;
        let mountCommit: number | null = null;
        let completeCommit: number | null = null;

        const observer = new MutationObserver(() => {
          commits += 1;
          if (mountCommit === null && getPopup() !== null) {
            mountCommit = commits;
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        onTestFinished(() => observer.disconnect());

        function onOpenChangeComplete(open: boolean) {
          if (open) {
            // A completion in a flush belongs to the call that the observer gets after it.
            completeCommit = commits + 1;
          }
        }

        const open = shallowRef(false);
        const App = defineComponent({
          setup: () => () => prepareComponent({ root: { open: open.value, onOpenChangeComplete } }),
        });

        await renderPopup(<App />);
        open.value = true;
        await waitFor(() => {
          expect(completeCommit).not.toBe(null);
        });

        expect(completeCommit).toBe(mountCommit);
      });
    });

    describe.skipIf(isJSDOM)('prop: onOpenChangeComplete', () => {
      afterEach(() => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
      });

      it('is not called on mount when closed', async () => {
        const onOpenChangeComplete = vi.fn();
        await renderPopup(prepareComponent({ root: { onOpenChangeComplete } }));

        expect(onOpenChangeComplete).not.toHaveBeenCalled();
      });

      it('is called on open when there is no enter animation', async () => {
        const onOpenChangeComplete = vi.fn();
        const { rerender } = await renderPopup(
          prepareComponent({ root: { open: false, onOpenChangeComplete } }),
        );

        await rerender(prepareComponent({ root: { open: true, onOpenChangeComplete } }));
        await waitFor(() => {
          expect(onOpenChangeComplete).toHaveBeenCalled();
        });
        await flushMicrotasks();
        expect(onOpenChangeComplete.mock.calls).toEqual([[true]]);
      });

      it('is called on close when there is no exit animation', async () => {
        const onOpenChangeComplete = vi.fn();
        const { rerender } = await renderPopup(
          prepareComponent({ root: { open: true, onOpenChangeComplete } }),
        );

        await rerender(prepareComponent({ root: { open: false, onOpenChangeComplete } }));
        await waitFor(expectPopupClosed);
        await waitFor(() => {
          expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
        });
        expect(onOpenChangeComplete.mock.calls).toEqual([[true], [false]]);
      });

      if (exitAnimation) {
        const animationName = `anim-${randomStringValue()}`;
        const className = `open-change-complete-${animationName}`;

        function AnimatedPopup(props: { open: boolean; onOpenChangeComplete: () => void }) {
          // Enter and exit use different keyframes: swapping the selector while keeping the
          // same animation name doesn't restart the animation.
          const style = `
            @keyframes ${animationName}-enter {
              from {
                opacity: 0;
              }
            }

            @keyframes ${animationName}-exit {
              to {
                opacity: 0;
              }
            }

            .${className}[data-open] {
              animation: ${animationName}-enter 200ms;
            }

            .${className}[data-ending-style] {
              animation: ${animationName}-exit 200ms;
            }
          `;

          return (
            <div>
              <style>{style}</style>
              {prepareComponent({
                root: { open: props.open, onOpenChangeComplete: props.onOpenChangeComplete },
                popup: { class: className },
              })}
            </div>
          );
        }

        // An animation runs only for a short time, so a case records what it needs at the
        // start of the animation and then waits for a state that stays.
        const recordAnimationStarts = (record: (popup: HTMLElement) => void) => {
          const listener = (event: Event) => {
            if (event.target === getPopup()) {
              record(event.target as HTMLElement);
            }
          };
          document.addEventListener('animationstart', listener);
          onTestFinished(() => document.removeEventListener('animationstart', listener));
        };

        it('is not called on close when onOpenChange prevents unmounting after an await', async () => {
          globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
          const onOpenChangeComplete = vi.fn();
          const { user } = await renderPopup(
            <div>
              <style>
                {`@keyframes ${animationName}-exit { to { opacity: 0; } }
                  .${className}[data-ending-style] { animation: ${animationName}-exit 200ms; }`}
              </style>
              {prepareComponent({
                root: {
                  defaultOpen: true,
                  onOpenChangeComplete,
                  onOpenChange: async (nextOpen, eventDetails) => {
                    if (!nextOpen) {
                      await Promise.resolve();
                      eventDetails.preventUnmountOnClose();
                    }
                  },
                },
                popup: { class: className },
              })}
            </div>,
          );
          expect(getPopup()).toBeVisible();

          await user.keyboard('[Escape]');
          await waitFor(() => {
            expect(getPopup()).toHaveAttribute('data-ending-style');
          });
          await wait(400);

          expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);
          expect(getPopup()).not.toBe(null);
        });

        it('is called on open once the enter animation finishes', async () => {
          globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
          const onOpenChangeComplete = vi.fn();
          const callsAtAnimationStart: number[] = [];
          recordAnimationStarts(() => {
            callsAtAnimationStart.push(onOpenChangeComplete.mock.calls.length);
          });
          const { setProps } = await renderPopup(
            <AnimatedPopup open={false} onOpenChangeComplete={onOpenChangeComplete} />,
          );

          await setProps({ open: true });

          await waitFor(() => {
            expect(onOpenChangeComplete).toHaveBeenCalled();
          });
          expect(callsAtAnimationStart).toEqual([0]);
          expect(onOpenChangeComplete.mock.calls).toEqual([[true]]);
        });

        it('is called on close once the exit animation finishes', async () => {
          globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
          const onOpenChangeComplete = vi.fn();
          const { setProps } = await renderPopup(
            <AnimatedPopup open onOpenChangeComplete={onOpenChangeComplete} />,
          );
          await waitFor(() => {
            expect(onOpenChangeComplete).toHaveBeenCalled();
          });
          onOpenChangeComplete.mockClear();
          const exitStarts: { isEnding: boolean; calls: number }[] = [];
          recordAnimationStarts((popup) => {
            exitStarts.push({
              isEnding: popup.hasAttribute('data-ending-style'),
              calls: onOpenChangeComplete.mock.calls.length,
            });
          });

          await setProps({ open: false });

          await waitFor(expectPopupClosed);
          expect(exitStarts).toEqual([{ isEnding: true, calls: 0 }]);
          expect(onOpenChangeComplete.mock.calls).toEqual([[false]]);
        });
      }
    });

    describe('animations', () => {
      beforeEach(() => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      });

      afterEach(() => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
      });

      it.skipIf(isJSDOM)('removes the popup when there is no exit animation defined', async () => {
        const { rerender } = await renderPopup(prepareComponent({ root: { open: true } }));

        await screen.findByTestId('popup');

        await rerender(prepareComponent({ root: { open: false } }));
        await waitFor(expectPopupClosed);
      });

      it.skipIf(isJSDOM || !exitAnimation)(
        'hides the kept-mounted popup once the exit animation finishes',
        async () => {
          const animationName = `anim-${randomStringValue()}`;

          function Test(props: { open: boolean }) {
            const style = `
            @keyframes ${animationName} {
              to {
                opacity: 0;
              }
            }

            .animation-test-popup-${animationName}[data-open] {
              opacity: 1;
            }

            .animation-test-popup-${animationName}[data-ending-style] {
              animation: ${animationName} 150ms;
            }
          `;

            return (
              <div>
                <style>{style}</style>
                {prepareComponent({
                  root: { open: props.open },
                  // Popups that stay mounted after opening don't accept `keepMounted`.
                  portal: alwaysMounted ? {} : { keepMounted: true },
                  popup: {
                    class: `animation-test-popup-${animationName}`,
                  },
                })}
              </div>
            );
          }

          const exitStarts: { isEnding: boolean; isInaccessible: boolean }[] = [];
          const listener = (event: Event) => {
            const popup = event.target as HTMLElement;
            if (popup === getPopup()) {
              exitStarts.push({
                isEnding: popup.hasAttribute('data-ending-style'),
                isInaccessible: isInaccessible(popup),
              });
            }
          };
          document.addEventListener('animationstart', listener);
          onTestFinished(() => document.removeEventListener('animationstart', listener));

          const { setProps } = await renderPopup(<Test open />);
          await setProps({ open: false });

          // The popup stays visible while the exit animation runs, and is hidden once it
          // finishes.
          await waitFor(() => {
            expect(isInaccessible(getPopup()!)).toBe(true);
          });
          expect(exitStarts).toEqual([{ isEnding: true, isInaccessible: false }]);
        },
      );
    });
  });
}

function getTrigger() {
  return screen.getByTestId('trigger');
}

function getPopup() {
  return screen.queryByTestId('popup');
}

// The root exposes its actions. A function ref gets them when the test renders a function.
function createActionsRef() {
  const actions = {
    current: null as PopupActions | null,
    ref: (instance: unknown) => {
      actions.current = instance as PopupActions | null;
    },
  };
  return actions;
}

export interface PopupTestConfig {
  /**
   * A function that returns a vnode with a component to test.
   * Its parameters contain props to be spread on the component's parts.
   */
  createComponent: (props: TestedComponentProps) => VNode;
  /**
   * How the popup is triggered.
   */
  triggerMouseAction: 'click' | 'hover';
  /**
   * Render function returned from `createRenderer`.
   */
  render: ReturnType<typeof createRenderer>['render'];
  /**
   * Expected `role` attribute of the popup element.
   */
  expectedPopupRole?: string;
  /**
   * Expected `aria-haspopup` attribute of the trigger element.
   */
  expectedAriaHasPopupValue?: string;
  /**
   * Set to `'only-after-open'` when the popup stays mounted (inaccessible) after it first closes.
   */
  alwaysMounted?: 'only-after-open';
  /**
   * Whether the popup is a combobox.
   */
  combobox?: boolean;
  /**
   * Whether the element receiving the `popup` props plays the enter and exit animations.
   * @default true
   */
  exitAnimation?: boolean;
  /**
   * The `reason` passed to `onOpenChange` when the trigger opens the popup.
   * @default 'trigger-press' for click triggers, 'trigger-hover' for hover triggers
   */
  openReason?: string;
}

interface PopupActions {
  close: () => void;
  unmount: () => void;
}

interface OpenChangeEventDetails {
  reason: string;
  cancel: () => void;
  preventUnmountOnClose: () => void;
}

interface RootProps {
  /**
   * A function ref that gets the exposed actions of the root.
   */
  ref?: (instance: unknown) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, eventDetails: OpenChangeEventDetails) => void;
  onOpenChangeComplete?: (open: boolean) => void;
}

interface TriggerProps {
  'data-testid'?: string;
  delay?: number;
  style?: CSSProperties;
}

interface PopupProps {
  class?: string;
  id?: string;
  'data-testid'?: string;
}

interface PortalProps {
  keepMounted?: boolean;
}

interface TestedComponentProps {
  root?: RootProps;
  popup?: PopupProps;
  trigger?: TriggerProps;
  portal?: PortalProps;
}
