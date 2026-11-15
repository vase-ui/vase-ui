import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import {
  createRenderer,
  detachedTriggersConformanceTests,
  fireEvent,
  flushMicrotasks,
  isJSDOM,
  nextAnimationsRead,
  screen,
  wait,
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

  detachedTriggersConformanceTests({
    render,
    createHandle: Menu.createHandle,
    Root: Menu.Root,
    Trigger: Menu.Trigger,
    Portal: Menu.Portal,
    Positioner: Menu.Positioner,
    Popup: Menu.Popup,
    Viewport: Menu.Viewport,
    openInteractions: ['click'],
    ariaExpanded: true,
    throwOnMissingTrigger: true,
  });

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

      // The switch to trigger 2 closes the popup and opens it again in one task. The popup thus
      // starts an exit and reverses it in the next frame, and the events of that exit can come
      // after the setup. Only the close that follows matters.
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

      // Only the close makes the part read the animations of the popup.
      const exitAnimations = await nextAnimationsRead(popup, {
        action: () => user.unhover(trigger2),
      });

      expect(exitAnimations.length).toBeGreaterThan(0);
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

      // Only the close makes the part read the animations of the popup.
      const exitAnimations = await nextAnimationsRead(popup, {
        action: () => user.unhover(trigger2),
      });
      expect(exitAnimations.length).toBeGreaterThan(0);
      expect(popup).toHaveAttribute('data-ending-style');

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

  describe.skipIf(isJSDOM)('nested menus', () => {
    describe.each([{ mode: 'contained' as const }, { mode: 'detached' as const }])(
      'with $mode triggers',
      ({ mode }) => {
        /**
         * Renders two triggers for one menu: as Root children (`contained`) or outside the Root,
         * connected with a handle (`detached`).
         */
        const TwoTriggerMenu = defineComponent({
          setup(_, { slots }) {
            const handle = Menu.createHandle();

            return () => {
              if (mode === 'contained') {
                return (
                  <Menu.Root>
                    <Menu.Trigger>Trigger 1</Menu.Trigger>
                    <Menu.Trigger>Trigger 2</Menu.Trigger>
                    {slots.default?.()}
                  </Menu.Root>
                );
              }

              return (
                <>
                  <Menu.Trigger handle={handle}>Trigger 1</Menu.Trigger>
                  <Menu.Trigger handle={handle}>Trigger 2</Menu.Trigger>
                  <Menu.Root handle={handle}>{slots.default?.()}</Menu.Root>
                </>
              );
            };
          },
        });

        it('supports keyboard navigation regardless of which trigger opened the menu', async () => {
          const { user } = await render(
            <TwoTriggerMenu>
              <Menu.Portal>
                <Menu.Positioner data-testid="menu">
                  <Menu.Popup>
                    <Menu.Item>Standalone</Menu.Item>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger data-testid="submenu-trigger">More</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner data-testid="submenu">
                          <Menu.Popup>
                            <Menu.Item data-testid="submenu-item">Nested</Menu.Item>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </TwoTriggerMenu>,
          );

          const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
          const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

          await user.click(trigger1);
          await screen.findByTestId('menu');
          // The menu focuses itself a frame after opening; keys sent earlier go to the trigger.
          await waitFor(() => {
            expect(screen.getByRole('menu')).toHaveFocus();
          });

          await user.keyboard('[ArrowDown]');
          await user.keyboard('[ArrowDown]');

          const submenuTrigger = await screen.findByTestId('submenu-trigger');
          await waitFor(() => {
            expect(submenuTrigger).toHaveFocus();
          });

          await user.keyboard('[ArrowRight]');

          const submenuItem = await screen.findByTestId('submenu-item');
          await waitFor(() => {
            expect(submenuItem).toHaveFocus();
          });

          await user.keyboard('[ArrowLeft]');
          await waitFor(() => {
            expect(screen.queryByTestId('submenu')).toBe(null);
          });
          expect(submenuTrigger).toHaveFocus();

          await user.keyboard('[Escape]');
          await waitFor(() => {
            expect(screen.queryByTestId('menu')).toBe(null);
          });

          await user.click(trigger2);
          await screen.findByTestId('menu');
        });

        it('opens a submenu on click when hover is disabled', async () => {
          const { user } = await render(
            <TwoTriggerMenu>
              <Menu.Portal>
                <Menu.Positioner data-testid="menu">
                  <Menu.Popup>
                    <Menu.Item>Standalone</Menu.Item>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger data-testid="submenu-trigger" openOnHover={false}>
                        More
                      </Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner data-testid="submenu">
                          <Menu.Popup>
                            <Menu.Item data-testid="submenu-item">Nested</Menu.Item>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </TwoTriggerMenu>,
          );

          const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
          const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

          await user.click(trigger1);
          await screen.findByTestId('menu');
          expect(screen.queryByTestId('submenu')).toBe(null);

          const submenuTrigger = screen.getByTestId('submenu-trigger');
          await user.click(submenuTrigger);

          const submenuItem = await screen.findByTestId('submenu-item');
          expect(submenuItem.textContent).toBe('Nested');

          await user.click(submenuItem);
          await waitFor(() => {
            expect(screen.queryByTestId('menu')).toBe(null);
          });

          await user.click(trigger2);
          await screen.findByTestId('menu');
          expect(screen.queryByTestId('submenu')).toBe(null);
        });

        it('closes every level when clicking outside the deepest submenu', async () => {
          const { user } = await render(
            <div>
              <TwoTriggerMenu>
                <Menu.Portal>
                  <Menu.Positioner data-testid="level-1">
                    <Menu.Popup>
                      <Menu.Item>Item 1</Menu.Item>
                      <Menu.SubmenuRoot>
                        <Menu.SubmenuTrigger data-testid="submenu-trigger-1">
                          Level 2
                        </Menu.SubmenuTrigger>
                        <Menu.Portal>
                          <Menu.Positioner data-testid="level-2">
                            <Menu.Popup>
                              <Menu.Item>Item 2</Menu.Item>
                              <Menu.SubmenuRoot>
                                <Menu.SubmenuTrigger data-testid="submenu-trigger-2">
                                  Level 3
                                </Menu.SubmenuTrigger>
                                <Menu.Portal>
                                  <Menu.Positioner data-testid="level-3">
                                    <Menu.Popup>
                                      <Menu.Item>Deep Item</Menu.Item>
                                    </Menu.Popup>
                                  </Menu.Positioner>
                                </Menu.Portal>
                              </Menu.SubmenuRoot>
                            </Menu.Popup>
                          </Menu.Positioner>
                        </Menu.Portal>
                      </Menu.SubmenuRoot>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </TwoTriggerMenu>
              <button data-testid="outside">Outside</button>
            </div>,
          );

          const trigger = screen.getByRole('button', { name: 'Trigger 1' });
          await user.click(trigger);
          await screen.findByTestId('level-1');
          // The menu focuses itself a frame after opening; keys sent earlier go to the trigger.
          await waitFor(() => {
            expect(screen.getByRole('menu')).toHaveFocus();
          });

          await user.keyboard('[ArrowDown]');
          await user.keyboard('[ArrowDown]');

          const submenuTrigger1 = await screen.findByTestId('submenu-trigger-1');
          await waitFor(() => {
            expect(submenuTrigger1).toHaveFocus();
          });

          await user.keyboard('[ArrowRight]');
          await screen.findByTestId('level-2');
          await waitFor(() => {
            expect(screen.getByRole('menuitem', { name: 'Item 2' })).toHaveFocus();
          });

          await user.keyboard('[ArrowDown]');
          const submenuTrigger2 = await screen.findByTestId('submenu-trigger-2');
          await waitFor(() => {
            expect(submenuTrigger2).toHaveFocus();
          });

          await user.keyboard('[ArrowRight]');
          await screen.findByTestId('level-3');

          await user.click(screen.getByTestId('outside'));
          await waitFor(() => {
            expect(screen.queryByTestId('level-1')).toBe(null);
          });
          expect(screen.queryByTestId('level-2')).toBe(null);
          expect(screen.queryByTestId('level-3')).toBe(null);
        });

        it('selects nested items with click, drag, release', async () => {
          const clickSpy = vi.fn();
          const { user } = await render(
            <TwoTriggerMenu>
              <Menu.Portal>
                <Menu.Positioner data-testid="menu">
                  <Menu.Popup>
                    <Menu.Item>Item 1</Menu.Item>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger data-testid="submenu-trigger">More</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner data-testid="submenu">
                          <Menu.Popup>
                            <Menu.Item data-testid="submenu-item" onClick={clickSpy}>
                              Nested Action
                            </Menu.Item>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </TwoTriggerMenu>,
          );

          const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
          await fireEvent.mouseDown(trigger1);

          await screen.findByTestId('menu');

          const submenuTrigger = await screen.findByTestId('submenu-trigger');
          await user.hover(submenuTrigger);
          await screen.findByTestId('submenu');

          // Wait 200ms to enable mouseup on menu items
          await wait(200);

          const submenuItem = await screen.findByTestId('submenu-item');
          await fireEvent.mouseUp(submenuItem);

          await waitFor(() => {
            expect(screen.queryByTestId('menu')).toBe(null);
          });
          expect(clickSpy.mock.calls.length).toBe(1);

          const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
          await user.click(trigger2);
          await screen.findByTestId('menu');
        });
      },
    );
  });

  describe('controlled open and triggerId fed from the change details, while StoreInspector serializes the store', () => {
    const handle = Menu.createHandle<string>();

    const App = defineComponent({
      setup() {
        const open = shallowRef(false);
        const triggerId = shallowRef<string | null>(null);

        return () => (
          <>
            <Menu.Root
              handle={handle}
              open={open.value}
              triggerId={triggerId.value}
              onOpenChange={(nextOpen: boolean, eventDetails: Menu.Root.ChangeEventDetails) => {
                open.value = nextOpen;
                triggerId.value = eventDetails.trigger?.id ?? null;
              }}
            >
              {{
                default: ({ payload }: { payload: string | undefined }) => (
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup data-testid="popup">
                        <Menu.Item>{payload}</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                ),
              }}
            </Menu.Root>
            <Menu.Trigger handle={handle} payload="Library">
              Library
            </Menu.Trigger>
            <Menu.Trigger handle={handle} payload="Playback" id="second-trigger">
              Playback
            </Menu.Trigger>
            <Menu.Trigger handle={handle} payload="Sharing">
              Sharing
            </Menu.Trigger>
            <button
              type="button"
              onClick={() => {
                open.value = true;
                triggerId.value = 'second-trigger';
              }}
            >
              Open externally
            </button>
            <button type="button" onClick={() => handle.open('second-trigger')}>
              Open via handle
            </button>
          </>
        );
      },
    });

    async function expectOpenWith(item: string) {
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).not.toBe(null);
      });
      await waitFor(() => {
        expect(screen.getByRole('menuitem')).toHaveTextContent(item);
      });
    }

    async function expectClosed() {
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
    }

    it('opens from each trigger, an item, and both external buttons', async () => {
      const { user } = await render(<App />);

      for (const name of ['Library', 'Playback', 'Sharing']) {
        const trigger = screen.getByRole('button', { name });
        await user.click(trigger);
        await expectOpenWith(name);
        expect(trigger).toHaveAttribute('aria-expanded', 'true');

        await user.click(screen.getByRole('menuitem'));
        await expectClosed();
      }

      await user.click(screen.getByRole('button', { name: 'Library' }));
      await expectOpenWith('Library');
      await user.click(screen.getByRole('button', { name: 'Sharing' }));
      await expectOpenWith('Sharing');
      await user.click(screen.getByRole('button', { name: 'Sharing' }));
      await expectClosed();

      await user.click(screen.getByRole('button', { name: 'Open externally' }));
      await expectOpenWith('Playback');
      await user.keyboard('[Escape]');
      await expectClosed();

      await user.click(screen.getByRole('button', { name: 'Open via handle' }));
      await expectOpenWith('Playback');
      await user.click(screen.getByRole('menuitem'));
      await expectClosed();
    });
  });
});
