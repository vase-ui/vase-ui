import { expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { shallowRef } from 'vue';
import type { VNode } from 'vue';
import type * as Dialog from '../src/dialog/index.parts';
import type * as Drawer from '../src/drawer/index.parts';
import * as Menu from '../src/menu/parts';
import * as Select from '../src/select/index.parts';
import { nextAnimationsRead, nextEvent } from './animation';
import { waitForLaterMillisecond } from './createRenderer';
import type { createRenderer } from './createRenderer';
import { FocusAtMount } from './fixtures/FocusAtMount';
import { flushMicrotasks } from './flushMicrotasks';
import { screen } from './queries';
import { waitFor } from './waitFor';

type PopupParts = Pick<typeof Dialog, 'Root' | 'Trigger' | 'Portal' | 'Popup'>;

/**
 * Dialog and Drawer return focus at close, before the popup unmounts. These cases cover nested
 * popups (`BUG-5519`) and focus targets inside a popup that closes (`BUG-6037`).
 */
export function nestedPopupCloseTests(config: NestedPopupCloseTestsConfig) {
  const { parts, wrapPopup, render } = config;
  // With a union of the two namespaces, JSX cannot type the parts. The suite only passes props
  // that both namespaces accept.
  const { Root, Trigger, Portal, Popup } = parts as PopupParts;

  // An exit animation of 100 s for the popups with these classes.
  const exitStyle = (classes: string[]) => `
    ${classes.map((name) => `.${name}[data-ending-style]`).join(', ')} {
      animation: nested-popup-exit 100s;
    }
    @keyframes nested-popup-exit { to { opacity: 0.5; } }
  `;

  // Runs `action` one time, and resolves when the exit animation of `popup` started. The listener
  // of `animationstart` records the focus: the focus that the return gives stays, so the listener
  // reads a state that lasts. The result also has the animations that the parts read for `popup`
  // and `otherPopups`. The count of frames of each wait starts when the action ends. The `finished`
  // promise of each animation comes when its read resolves: the browser can cancel a finished
  // animation when its element goes, and `finished` then gives a new promise that never settles.
  async function startExit(
    popup: HTMLElement,
    otherPopups: Element[],
    action: () => Promise<unknown>,
  ) {
    const record: { focusAtExitStart: Element | null } = { focusAtExitStart: null };
    popup.addEventListener(
      'animationstart',
      () => {
        record.focusAtExitStart = document.activeElement;
      },
      { once: true },
    );
    let actionResult: Promise<unknown> | undefined;
    const runAction = () => (actionResult ??= action());
    const [reads] = await Promise.all([
      Promise.all(
        [popup, ...otherPopups].map((element) =>
          nextAnimationsRead(element, { action: runAction }).then((animations) =>
            animations.map((animation) => ({ animation, finished: animation.finished })),
          ),
        ),
      ),
      nextEvent(popup, 'animationstart', { action: runAction }),
    ]);
    return { ...record, exits: reads.flat() };
  }

  // Ends each animation, and waits for the ends with no time limit. A busy machine can stall the
  // page for some seconds.
  async function finishExits(exits: Awaited<ReturnType<typeof startExit>>['exits']) {
    for (const { animation } of exits) {
      animation.finish();
    }
    await Promise.all(exits.map(({ finished }) => finished));
  }

  // A popup takes the focus in an animation frame after the open. A click of `user` focuses
  // `control` first, so `control` takes the focus before the action. The next `focusin` event is
  // then the move into the popup.
  async function openAndWaitForFocus(control: HTMLElement, action: () => Promise<unknown>) {
    control.focus();
    await nextEvent(document, 'focusin', { action });
  }

  // A root reads the animations of its popup in a frame after the open, to report the end of the
  // open. The wait for the read of a close must start after that read.
  async function waitForOpenChangeComplete(onOpenChangeComplete: ReturnType<typeof vi.fn>) {
    await waitFor(() => {
      expect(onOpenChangeComplete).toHaveBeenCalledWith(true);
    });
  }

  it.each([
    { name: 'both popups animate', innerAnimates: true, modal: true },
    { name: 'only the outer popup animates', innerAnimates: false, modal: true },
    { name: 'the popups are not modal', innerAnimates: true, modal: false },
  ])(
    'BUG-5519: returns the focus to the outer trigger when a nested popup closes with it: $name',
    async ({ innerAnimates, modal }) => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const outerOpen = shallowRef(false);
      const innerOpen = shallowRef(false);
      const onOuterOpenChangeComplete = vi.fn();
      const onInnerOpenChangeComplete = vi.fn();
      const { user } = await render(() => (
        <div>
          <style>{exitStyle(innerAnimates ? ['outer', 'inner'] : ['outer'])}</style>
          <Root
            modal={modal}
            open={outerOpen.value}
            onOpenChange={(open: boolean) => {
              outerOpen.value = open;
            }}
            onOpenChangeComplete={onOuterOpenChangeComplete}
          >
            <Trigger>Open outer</Trigger>
            <Portal>
              {wrapPopup(
                <Popup class="outer" data-testid="outer-popup">
                  <Root
                    modal={modal}
                    open={innerOpen.value}
                    onOpenChange={(open: boolean) => {
                      innerOpen.value = open;
                    }}
                    onOpenChangeComplete={onInnerOpenChangeComplete}
                  >
                    <Trigger>Open inner</Trigger>
                    <Portal>
                      {wrapPopup(
                        <Popup class="inner" data-testid="inner-popup">
                          <button
                            onClick={() => {
                              innerOpen.value = false;
                              outerOpen.value = false;
                            }}
                          >
                            Discard
                          </button>
                        </Popup>,
                      )}
                    </Portal>
                  </Root>
                </Popup>,
              )}
            </Portal>
          </Root>
        </div>
      ));
      const outerTrigger = screen.getByRole('button', { name: 'Open outer' });

      await waitForLaterMillisecond(() =>
        openAndWaitForFocus(outerTrigger, () => user.click(outerTrigger)),
      );
      const outerPopup = screen.getByTestId('outer-popup');
      expect(outerPopup.contains(document.activeElement)).toBe(true);
      const innerTrigger = screen.getByRole('button', { name: 'Open inner' });
      await waitForLaterMillisecond(() =>
        openAndWaitForFocus(innerTrigger, () => user.click(innerTrigger)),
      );
      const innerPopup = screen.getByTestId('inner-popup');
      expect(innerPopup.contains(document.activeElement)).toBe(true);
      await waitForOpenChangeComplete(onOuterOpenChangeComplete);
      if (innerAnimates) {
        await waitForOpenChangeComplete(onInnerOpenChangeComplete);
      }

      const { focusAtExitStart, exits } = await startExit(
        outerPopup,
        innerAnimates ? [innerPopup] : [],
        () => user.click(screen.getByRole('button', { name: 'Discard' })),
      );
      await finishExits(exits);
      await flushMicrotasks();
      expect(screen.queryByTestId('outer-popup')).toBe(null);

      expect(focusAtExitStart).toBe(outerTrigger);
      expect(outerTrigger).toHaveFocus();
    },
  );

  function renderList(list: 'menu' | 'select', onItemClick?: () => void) {
    return list === 'menu' ? (
      <Menu.Root>
        <Menu.Trigger data-testid="list-trigger">Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="list-popup">
              <Menu.Item onClick={onItemClick}>Delete</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ) : (
      <Select.Root>
        <Select.Trigger data-testid="list-trigger">Actions</Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup data-testid="list-popup">
              <Select.Item value="delete" onClick={onItemClick}>
                Delete
              </Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    );
  }

  async function openWithoutTrigger(content: () => VNode, fromMenu = false) {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    const open = shallowRef(false);
    const onOpenChangeComplete = vi.fn();
    const setOpen = (value: boolean) => {
      open.value = value;
    };
    const { user } = await render(() => (
      <div>
        <style>{exitStyle(['outer'])}</style>
        <Menu.Root>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item onClick={() => setOpen(true)}>Edit</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
        <Root open={open.value} onOpenChange={setOpen} onOpenChangeComplete={onOpenChangeComplete}>
          <Portal>
            {wrapPopup(
              <Popup class="outer" data-testid="outer-popup">
                {content()}
                <button onClick={() => setOpen(false)}>Close</button>
              </Popup>,
            )}
          </Portal>
        </Root>
      </div>
    ));
    const actions = screen.getByRole('button', { name: 'Actions' });
    await waitForLaterMillisecond(() =>
      openAndWaitForFocus(actions, () => user.keyboard('{Enter}')),
    );
    if (fromMenu) {
      await waitForLaterMillisecond(() =>
        user.click(screen.getByRole('menuitem', { name: 'Edit' })),
      );
    } else {
      await user.keyboard('{Escape}');
      await waitFor(() => expect(actions).toHaveFocus());
      actions.blur();
      expect(document.body).toHaveFocus();
      await waitForLaterMillisecond(() =>
        nextEvent(document, 'focusin', { action: () => setOpen(true) }),
      );
    }
    const popup = screen.getByTestId('outer-popup');
    await waitForOpenChangeComplete(onOpenChangeComplete);
    expect(popup.contains(document.activeElement)).toBe(true);

    async function checkReturn(
      action = () => user.click(screen.getByRole('button', { name: 'Close' })),
    ) {
      const { focusAtExitStart, exits } = await startExit(popup, [], action);
      await finishExits(exits);
      await flushMicrotasks();
      expect(popup).not.toBeInTheDocument();
      expect(focusAtExitStart).toBe(actions);
      expect(actions).toHaveFocus();
    }
    return { user, popup, checkReturn };
  }

  async function checkSelectSkip(fromMenu: boolean) {
    const { user, checkReturn } = await openWithoutTrigger(() => renderList('select'), fromMenu);
    const trigger = screen.getByTestId('list-trigger');
    await waitForLaterMillisecond(() =>
      openAndWaitForFocus(trigger, () => user.keyboard('{Enter}')),
    );
    expect(screen.getByTestId('list-popup').contains(document.activeElement)).toBe(true);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());

    await checkReturn();
  }

  // A popup of the old layer returns the focus to the trigger of an earlier popup of that layer.
  // The menu is on the popup layer, so the old layer does not know its trigger. The case runs again
  // when the Dialog and Drawer units move these families to the popup layer.
  it.skip('BUG-6037: skips the trigger of a select that was open in the popup: the app opens the popup', () =>
    checkSelectSkip(false));

  it('BUG-6037: skips the trigger of a select that was open in the popup: a menu item opens the popup', () =>
    checkSelectSkip(true));

  // The old layer does not know the trigger of a menu on the popup layer. The case runs again when
  // the Dialog and Drawer units move these families to the popup layer.
  it.skip('BUG-6037: returns focus to the earlier menu trigger after a press outside', async () => {
    // The drawer viewport needs space for a press outside its popup.
    const { popup, checkReturn } = await openWithoutTrigger(() => (
      <style>{'[role="presentation"]:has(> .outer) { position: relative; padding: 12px; }'}</style>
    ));
    const outside =
      popup.closest('[role="presentation"]') ?? screen.getByRole('presentation', { hidden: true });

    await checkReturn(() => userEvent.click(outside, { position: { x: 2, y: 2 } }));
  });

  // The old layer does not know the trigger of a menu on the popup layer. The case runs again when
  // the Dialog and Drawer units move these families to the popup layer.
  it.skip('BUG-6037: returns focus to the earlier menu trigger after a field takes focus at mount', async () => {
    const { checkReturn } = await openWithoutTrigger(() => <FocusAtMount data-testid="field" />);
    expect(screen.getByTestId('field')).toHaveFocus();

    await checkReturn();
  });

  it.each<{ name: string; list: 'menu' | 'select'; modal: boolean }>([
    { name: 'a menu in a modal popup', list: 'menu', modal: true },
    { name: 'a menu in a popup that is not modal', list: 'menu', modal: false },
    { name: 'a select in a modal popup', list: 'select', modal: true },
  ])(
    'BUG-5519: returns the focus to the trigger when an item closes the popup: $name',
    async ({ list, modal }) => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const open = shallowRef(false);
      const onOpenChangeComplete = vi.fn();
      const closePopup = () => {
        open.value = false;
      };
      const { user } = await render(() => (
        <div>
          <style>{exitStyle(['outer'])}</style>
          <Root
            modal={modal}
            open={open.value}
            onOpenChange={(nextOpen: boolean) => {
              open.value = nextOpen;
            }}
            onOpenChangeComplete={onOpenChangeComplete}
          >
            <Trigger>Open</Trigger>
            <Portal>
              {wrapPopup(
                <Popup class="outer" data-testid="outer-popup">
                  {renderList(list, closePopup)}
                </Popup>,
              )}
            </Portal>
          </Root>
        </div>
      ));
      const trigger = screen.getByRole('button', { name: 'Open' });

      await waitForLaterMillisecond(() => openAndWaitForFocus(trigger, () => user.click(trigger)));
      const outerPopup = screen.getByTestId('outer-popup');
      expect(outerPopup.contains(document.activeElement)).toBe(true);
      const listTrigger = screen.getByTestId('list-trigger');
      await waitForLaterMillisecond(() =>
        openAndWaitForFocus(listTrigger, () => user.keyboard('{Enter}')),
      );
      expect(screen.getByTestId('list-popup').contains(document.activeElement)).toBe(true);
      await waitForOpenChangeComplete(onOpenChangeComplete);

      const { focusAtExitStart, exits } = await startExit(outerPopup, [], () =>
        user.keyboard('{ArrowDown}{Enter}'),
      );
      await finishExits(exits);
      await flushMicrotasks();
      expect(screen.queryByTestId('outer-popup')).toBe(null);

      expect(focusAtExitStart).toBe(trigger);
      expect(trigger).toHaveFocus();
    },
  );

  it('BUG-5519: returns the focus to the outer trigger when the nested popup closes during the exit of the outer popup', async () => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    const outerOpen = shallowRef(false);
    const innerOpen = shallowRef(false);
    const onOuterOpenChangeComplete = vi.fn();
    const { user } = await render(() => (
      <div>
        <style>{exitStyle(['outer'])}</style>
        <Root
          open={outerOpen.value}
          onOpenChange={(open: boolean) => {
            outerOpen.value = open;
          }}
          onOpenChangeComplete={onOuterOpenChangeComplete}
        >
          <Trigger>Open outer</Trigger>
          <Portal>
            {wrapPopup(
              <Popup class="outer" data-testid="outer-popup">
                <Root
                  open={innerOpen.value}
                  onOpenChange={(open: boolean) => {
                    innerOpen.value = open;
                  }}
                >
                  <Trigger>Open inner</Trigger>
                  <Portal>
                    {wrapPopup(
                      <Popup data-testid="inner-popup">
                        <button
                          onClick={() => {
                            outerOpen.value = false;
                          }}
                        >
                          Close outer
                        </button>
                        <button
                          onClick={() => {
                            innerOpen.value = false;
                          }}
                        >
                          Close inner
                        </button>
                      </Popup>,
                    )}
                  </Portal>
                </Root>
              </Popup>,
            )}
          </Portal>
        </Root>
      </div>
    ));
    const outerTrigger = screen.getByRole('button', { name: 'Open outer' });

    await waitForLaterMillisecond(() =>
      openAndWaitForFocus(outerTrigger, () => user.click(outerTrigger)),
    );
    const outerPopup = screen.getByTestId('outer-popup');
    expect(outerPopup.contains(document.activeElement)).toBe(true);
    const innerTrigger = screen.getByRole('button', { name: 'Open inner' });
    await waitForLaterMillisecond(() =>
      openAndWaitForFocus(innerTrigger, () => user.click(innerTrigger)),
    );
    const innerPopup = screen.getByTestId('inner-popup');
    expect(innerPopup.contains(document.activeElement)).toBe(true);
    await waitForOpenChangeComplete(onOuterOpenChangeComplete);

    const { focusAtExitStart, exits } = await startExit(outerPopup, [], () =>
      user.click(screen.getByRole('button', { name: 'Close outer' })),
    );
    expect(innerPopup.contains(focusAtExitStart)).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Close inner' }));
    await waitFor(() => {
      expect(innerPopup).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId('inner-popup')).toBe(null);
    expect(outerPopup).toBeInTheDocument();
    expect(outerTrigger).toHaveFocus();

    await finishExits(exits);
    await flushMicrotasks();
    expect(screen.queryByTestId('outer-popup')).toBe(null);
    expect(outerTrigger).toHaveFocus();
  });

  it.each([
    { name: 'the outer popup animates', outerAnimates: true },
    { name: 'the outer popup does not animate', outerAnimates: false },
  ])(
    'BUG-5519: keeps the focus in a nested popup that stays open, and returns it to the outer trigger at the unmount: $name',
    async ({ outerAnimates }) => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = !outerAnimates;
      const outerOpen = shallowRef(false);
      const innerOpen = shallowRef(false);
      const onOuterOpenChangeComplete = vi.fn();
      const { user } = await render(() => (
        <div>
          {outerAnimates ? <style>{exitStyle(['outer'])}</style> : null}
          <Root
            open={outerOpen.value}
            onOpenChange={(open: boolean) => {
              outerOpen.value = open;
            }}
            onOpenChangeComplete={onOuterOpenChangeComplete}
          >
            <Trigger>Open outer</Trigger>
            <Portal>
              {wrapPopup(
                <Popup class="outer" data-testid="outer-popup">
                  <Root
                    open={innerOpen.value}
                    onOpenChange={(open: boolean) => {
                      innerOpen.value = open;
                    }}
                  >
                    <Trigger>Open inner</Trigger>
                    <Portal>
                      {wrapPopup(
                        <Popup data-testid="inner-popup">
                          <button
                            onClick={() => {
                              outerOpen.value = false;
                            }}
                          >
                            Close outer
                          </button>
                        </Popup>,
                      )}
                    </Portal>
                  </Root>
                </Popup>,
              )}
            </Portal>
          </Root>
        </div>
      ));
      const outerTrigger = screen.getByRole('button', { name: 'Open outer' });

      await waitForLaterMillisecond(() =>
        openAndWaitForFocus(outerTrigger, () => user.click(outerTrigger)),
      );
      const outerPopup = screen.getByTestId('outer-popup');
      expect(outerPopup.contains(document.activeElement)).toBe(true);
      const innerTrigger = screen.getByRole('button', { name: 'Open inner' });
      await waitForLaterMillisecond(() =>
        openAndWaitForFocus(innerTrigger, () => user.click(innerTrigger)),
      );
      const innerPopup = screen.getByTestId('inner-popup');
      expect(innerPopup.contains(document.activeElement)).toBe(true);

      if (outerAnimates) {
        await waitForOpenChangeComplete(onOuterOpenChangeComplete);
        const { focusAtExitStart, exits } = await startExit(outerPopup, [], () =>
          user.click(screen.getByRole('button', { name: 'Close outer' })),
        );
        expect(innerPopup.contains(focusAtExitStart)).toBe(true);
        expect(innerPopup.contains(document.activeElement)).toBe(true);

        await finishExits(exits);
      } else {
        await user.click(screen.getByRole('button', { name: 'Close outer' }));
      }
      await flushMicrotasks();

      expect(screen.queryByTestId('outer-popup')).toBe(null);
      expect(screen.queryByTestId('inner-popup')).toBe(null);
      expect(outerTrigger).toHaveFocus();
    },
  );

  it('BUG-5519: returns the focus to the outer trigger when a nested popup closes after a kept outer popup closed', async () => {
    const outerOpen = shallowRef(false);
    const innerOpen = shallowRef(false);
    const { user } = await render(() => (
      <div>
        <Root
          open={outerOpen.value}
          onOpenChange={(open: boolean) => {
            outerOpen.value = open;
          }}
        >
          <Trigger>Open outer</Trigger>
          <Portal keepMounted>
            {wrapPopup(
              <Popup data-testid="outer-popup">
                <Root
                  open={innerOpen.value}
                  onOpenChange={(open: boolean) => {
                    innerOpen.value = open;
                  }}
                >
                  <Trigger>Open inner</Trigger>
                  <Portal>
                    {wrapPopup(
                      <Popup data-testid="inner-popup">
                        <button
                          onClick={() => {
                            outerOpen.value = false;
                          }}
                        >
                          Close outer
                        </button>
                        <button
                          onClick={() => {
                            innerOpen.value = false;
                          }}
                        >
                          Close inner
                        </button>
                      </Popup>,
                    )}
                  </Portal>
                </Root>
              </Popup>,
            )}
          </Portal>
        </Root>
      </div>
    ));
    const outerTrigger = screen.getByRole('button', { name: 'Open outer' });

    await waitForLaterMillisecond(() =>
      openAndWaitForFocus(outerTrigger, () => user.click(outerTrigger)),
    );
    const outerPopup = screen.getByTestId('outer-popup');
    expect(outerPopup.contains(document.activeElement)).toBe(true);
    const innerTrigger = screen.getByRole('button', { name: 'Open inner' });
    await waitForLaterMillisecond(() =>
      openAndWaitForFocus(innerTrigger, () => user.click(innerTrigger)),
    );
    const innerPopup = screen.getByTestId('inner-popup');
    expect(innerPopup.contains(document.activeElement)).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Close outer' }));
    await flushMicrotasks();
    expect(outerPopup).toBeInTheDocument();
    expect(innerPopup.contains(document.activeElement)).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Close inner' }));
    await flushMicrotasks();

    expect(screen.queryByTestId('inner-popup')).toBe(null);
    expect(outerTrigger).toHaveFocus();
  });
}

export interface NestedPopupCloseTestsConfig {
  /**
   * The component namespace to test.
   */
  parts: PopupParts | Pick<typeof Drawer, 'Root' | 'Trigger' | 'Portal' | 'Popup'>;
  /**
   * Puts a popup in the parts that the family needs around it, such as `Drawer.Viewport`.
   */
  wrapPopup: (popup: VNode) => VNode;
  /**
   * Render function returned from `createRenderer`.
   */
  render: ReturnType<typeof createRenderer>['render'];
}
