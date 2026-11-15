import { expect, it } from 'vitest';
import { shallowRef } from 'vue';
import type { VNode } from 'vue';
import { screen } from '@testing-library/dom';
import type * as Dialog from '../src/dialog/index.parts';
import type * as Drawer from '../src/drawer/index.parts';
import * as Menu from '../src/menu/index.parts';
import * as Select from '../src/select/index.parts';
import { nextAnimationsRead, nextEvent } from './animation';
import { waitForLaterMillisecond } from './createRenderer';
import type { createRenderer } from './createRenderer';
import { flushMicrotasks } from './flushMicrotasks';

type PopupParts = Pick<typeof Dialog, 'Root' | 'Trigger' | 'Portal' | 'Popup'>;

/**
 * The return of the focus of a popup that closes in the same update as a popup inside it
 * (`BUG-5519`). Dialog and Drawer stop their focus manager when the popup closes, so the focus
 * returns at the close and not at the unmount.
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
      const { user } = await render(() => (
        <div>
          <style>{exitStyle(innerAnimates ? ['outer', 'inner'] : ['outer'])}</style>
          <Root
            modal={modal}
            open={outerOpen.value}
            onOpenChange={(open: boolean) => {
              outerOpen.value = open;
            }}
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

      await openAndWaitForFocus(outerTrigger, () => user.click(outerTrigger));
      const outerPopup = screen.getByTestId('outer-popup');
      expect(outerPopup.contains(document.activeElement)).toBe(true);
      await waitForLaterMillisecond();
      const innerTrigger = screen.getByRole('button', { name: 'Open inner' });
      await openAndWaitForFocus(innerTrigger, () => user.click(innerTrigger));
      const innerPopup = screen.getByTestId('inner-popup');
      expect(innerPopup.contains(document.activeElement)).toBe(true);
      await waitForLaterMillisecond();

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

  // A menu or a select in the popup. Its item closes the popup.
  function renderList(list: 'menu' | 'select', closePopup: () => void) {
    return list === 'menu' ? (
      <Menu.Root>
        <Menu.Trigger data-testid="list-trigger">Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="list-popup">
              <Menu.Item onClick={closePopup}>Delete</Menu.Item>
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
              <Select.Item value="delete" onClick={closePopup}>
                Delete
              </Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    );
  }

  it.each<{ name: string; list: 'menu' | 'select'; modal: boolean }>([
    { name: 'a menu in a modal popup', list: 'menu', modal: true },
    { name: 'a menu in a popup that is not modal', list: 'menu', modal: false },
    { name: 'a select in a modal popup', list: 'select', modal: true },
  ])(
    'BUG-5519: returns the focus to the trigger when an item closes the popup: $name',
    async ({ list, modal }) => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const open = shallowRef(false);
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

      await openAndWaitForFocus(trigger, () => user.click(trigger));
      const outerPopup = screen.getByTestId('outer-popup');
      expect(outerPopup.contains(document.activeElement)).toBe(true);
      const listTrigger = screen.getByTestId('list-trigger');
      await waitForLaterMillisecond();
      await openAndWaitForFocus(listTrigger, () => user.keyboard('{Enter}'));
      expect(screen.getByTestId('list-popup').contains(document.activeElement)).toBe(true);
      await waitForLaterMillisecond();

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
