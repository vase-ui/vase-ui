import { describe, expect, it, vi } from 'vitest';
import { KeepAlive, defineComponent, shallowRef } from 'vue';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  isInaccessible,
  popupFocusPropsTests,
  screen,
  takeReportedMessages,
  waitFor,
  waitSingleFrame,
} from '#test-utils';
import * as AlertDialog from '../../alert-dialog/index.parts';
import * as Popover from '../../popover/index.parts';
import * as Dialog from '../index.parts';
import type { DialogStore } from '../store/DialogStore';
import DialogPopupReplacement from './DialogPopupReplacement.test.vue';

describe('<Dialog.Popup />', () => {
  const { render } = createRenderer();

  describeConformance(<Dialog.Popup />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) => {
      return render(
        <Dialog.Root open modal={false}>
          <Dialog.Portal>{node}</Dialog.Portal>
        </Dialog.Root>,
      );
    },
  }));

  describe('prop: keepMounted', () => {
    it('should keep the dialog mounted when keepMounted=true', async () => {
      await render(
        <Dialog.Root open={false} modal={false}>
          <Dialog.Portal keepMounted>
            <Dialog.Popup />
          </Dialog.Portal>
        </Dialog.Root>,
      );

      expect(isInaccessible(screen.getByRole('dialog', { hidden: true }))).toBe(true);
    });

    it.each([
      { name: 'false', keepMounted: false },
      { name: 'undefined', keepMounted: undefined },
    ])('should not keep the dialog mounted when keepMounted=$name', async ({ keepMounted }) => {
      await render(
        <Dialog.Root open={false} modal={false}>
          <Dialog.Portal keepMounted={keepMounted}>
            <Dialog.Popup />
          </Dialog.Portal>
        </Dialog.Root>,
      );

      expect(screen.queryByRole('dialog', { hidden: true })).toBe(null);
    });
  });

  // A modal dialog traps focus and marks the rest of the page inert, so it resolves the focus props
  // through a different path than a non-modal one.
  describe('modal', () => {
    popupFocusPropsTests({
      render,
      outsideElementsInert: true,
      createComponent: ({ children, ...focusProps }) => (
        <Dialog.Root>
          <Dialog.Trigger>Open</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Backdrop />
            <Dialog.Popup {...focusProps}>
              {children}
              <Dialog.Close>Close</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ),
    });
  });

  describe('non-modal', () => {
    popupFocusPropsTests({
      render,
      createComponent: ({ children, ...focusProps }) => (
        <Dialog.Root modal={false}>
          <Dialog.Trigger>Open</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup {...focusProps}>
              {children}
              <Dialog.Close>Close</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ),
    });
  });

  describe('prop: initialFocus', () => {
    it('focuses the popup itself rather than inner content when opened by touch', async () => {
      await render(
        <Dialog.Root modal={false}>
          <Dialog.Trigger>Open</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup data-testid="dialog">
              <input data-testid="input" />
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>,
      );

      const trigger = screen.getByText('Open');
      await fireEvent.pointerDown(trigger, { pointerType: 'touch' });
      await fireEvent.click(trigger, { detail: 1 });

      // On touch the default focuses the popup to avoid opening the virtual keyboard.
      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toHaveFocus();
      });
      expect(screen.getByTestId('input')).not.toHaveFocus();
    });
  });

  describe('display: contents ancestors', () => {
    it('keeps initial focus working when the popup is wrapped by a display: contents ancestor', async () => {
      const { user } = await render(
        <div>
          <button data-testid="outside-before">Outside before</button>
          <Dialog.Root modal={false}>
            <Dialog.Trigger>Open</Dialog.Trigger>
            <Dialog.Portal>
              <form style={{ display: 'contents' }}>
                <Dialog.Popup data-testid="dialog-popup">
                  <input data-testid="dialog-input" />
                  <button type="button">Close</button>
                </Dialog.Popup>
              </form>
            </Dialog.Portal>
          </Dialog.Root>
          <button data-testid="outside-after">Outside after</button>
        </div>,
      );

      await user.click(screen.getByText('Open'));

      await waitFor(() => {
        expect(screen.getByTestId('dialog-input')).toHaveFocus();
      });
    });

    it('keeps trap-focus tab cycling inside the popup when wrapped by a display: contents ancestor', async () => {
      const { user } = await render(
        <div>
          <button data-testid="outside-before">Outside before</button>
          <Dialog.Root defaultOpen modal="trap-focus">
            <Dialog.Portal>
              <form style={{ display: 'contents' }}>
                <Dialog.Popup data-testid="dialog-popup">
                  <input data-testid="first-input" />
                  <button type="button" data-testid="second-button">
                    Second
                  </button>
                </Dialog.Popup>
              </form>
            </Dialog.Portal>
          </Dialog.Root>
          <button data-testid="outside-after">Outside after</button>
        </div>,
      );

      const popup = screen.getByTestId('dialog-popup');

      await waitFor(() => {
        expect(screen.getByTestId('first-input')).toHaveFocus();
      });

      await user.keyboard('[Tab]');
      expect(screen.getByTestId('second-button')).toHaveFocus();

      await user.keyboard('[Tab]');
      await waitFor(() => {
        expect(screen.getByTestId('first-input')).toHaveFocus();
      });
      expect(screen.getByTestId('outside-before')).not.toHaveFocus();
      expect(screen.getByTestId('outside-after')).not.toHaveFocus();

      await user.keyboard('[ShiftLeft>][Tab][/ShiftLeft]');
      await waitFor(() => {
        expect(screen.getByTestId('second-button')).toHaveFocus();
      });
      expect(popup.contains(document.activeElement)).toBe(true);
    });
  });

  it('does not return focus to the trigger of a popover that opened by default', async () => {
    const open = shallowRef(false);
    const App = defineComponent(() => () => (
      <>
        <Popover.Root defaultOpen>
          <Popover.Trigger>Tip</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>
                <Popover.Close>Got it</Popover.Close>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
        <Dialog.Root
          open={open.value}
          onOpenChange={(nextOpen: boolean) => {
            open.value = nextOpen;
          }}
        >
          <Dialog.Portal>
            <Dialog.Popup>
              <Dialog.Close>Close</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </>
    ));

    const { user } = await render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Got it' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Got it' })).toBe(null);
    });
    (document.activeElement as HTMLElement).blur();

    open.value = true;
    const close = await screen.findByRole('button', { name: 'Close' });
    await waitFor(() => {
      expect(close).toHaveFocus();
    });
    await user.keyboard('[Escape]');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null);
    });
    await flushMicrotasks();
    expect(screen.getByRole('button', { name: 'Tip' })).not.toHaveFocus();
  });

  describe('nested dialog count', () => {
    it('provides the number of open nested dialogs as a CSS variable', async () => {
      const { user } = await render(
        <Dialog.Root>
          <Dialog.Trigger>Trigger 0</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup data-testid="popup0">
              <Dialog.Root>
                <Dialog.Trigger>Trigger 1</Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Popup data-testid="popup1">
                    <Dialog.Root>
                      <Dialog.Trigger>Trigger 2</Dialog.Trigger>
                      <Dialog.Portal>
                        <Dialog.Popup data-testid="popup2">
                          <Dialog.Close>Close 2</Dialog.Close>
                        </Dialog.Popup>
                      </Dialog.Portal>
                    </Dialog.Root>
                    <Dialog.Close>Close 1</Dialog.Close>
                  </Dialog.Popup>
                </Dialog.Portal>
              </Dialog.Root>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>,
      );

      await user.click(screen.getByRole('button', { name: 'Trigger 0' }));

      await waitFor(() => {
        expect(screen.getByTestId('popup0')).not.toBe(null);
      });

      const computedStyles = getComputedStyle(screen.getByTestId('popup0'));

      expect(computedStyles.getPropertyValue('--nested-dialogs')).toBe('0');

      await user.click(screen.getByRole('button', { name: 'Trigger 1' }));

      await waitFor(() => {
        expect(screen.getByTestId('popup1')).not.toBe(null);
      });

      expect(computedStyles.getPropertyValue('--nested-dialogs')).toBe('1');

      await user.click(screen.getByRole('button', { name: 'Trigger 2' }));

      await waitFor(() => {
        expect(screen.getByTestId('popup2')).not.toBe(null);
      });

      expect(computedStyles.getPropertyValue('--nested-dialogs')).toBe('2');

      await user.click(screen.getByRole('button', { name: 'Close 2' }));

      expect(computedStyles.getPropertyValue('--nested-dialogs')).toBe('1');

      await user.click(screen.getByRole('button', { name: 'Close 1' }));

      expect(computedStyles.getPropertyValue('--nested-dialogs')).toBe('0');
    });

    it('decrements the count when an open nested dialog is unmounted', async () => {
      const App = defineComponent(() => {
        const showNested = shallowRef(true);
        return () => (
          <>
            <button onClick={() => (showNested.value = !showNested.value)}>toggle</button>
            <Dialog.Root>
              <Dialog.Trigger>Trigger 0</Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Popup data-testid="popup0">
                  {showNested.value && (
                    <Dialog.Root>
                      <Dialog.Trigger>Trigger 1</Dialog.Trigger>
                      <Dialog.Portal>
                        <Dialog.Popup data-testid="popup1">
                          <Dialog.Close>Close 1</Dialog.Close>
                        </Dialog.Popup>
                      </Dialog.Portal>
                    </Dialog.Root>
                  )}
                  <Dialog.Close>Close 0</Dialog.Close>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </>
        );
      });

      const { user } = await render(<App />);

      await user.click(screen.getByRole('button', { name: 'Trigger 0' }));

      await waitFor(() => {
        expect(screen.getByTestId('popup0')).not.toBe(null);
      });

      const computedStyles = getComputedStyle(screen.getByTestId('popup0'));

      expect(computedStyles.getPropertyValue('--nested-dialogs')).toBe('0');

      await user.click(screen.getByRole('button', { name: 'Trigger 1' }));

      await waitFor(() => {
        expect(screen.getByTestId('popup1')).not.toBe(null);
      });

      expect(computedStyles.getPropertyValue('--nested-dialogs')).toBe('1');

      await user.click(screen.getByRole('button', { name: 'toggle', hidden: true }));

      expect(computedStyles.getPropertyValue('--nested-dialogs')).toBe('0');
    });

    it('does not change the count when a closed nested dialog is unmounted', async () => {
      const App = defineComponent(() => {
        const showNested = shallowRef(true);
        return () => (
          <Dialog.Root>
            <Dialog.Trigger>Trigger 0</Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Popup data-testid="popup0">
                {showNested.value && (
                  <Dialog.Root>
                    <Dialog.Trigger />
                    <Dialog.Portal>
                      <Dialog.Popup />
                    </Dialog.Portal>
                  </Dialog.Root>
                )}
                <button onClick={() => (showNested.value = !showNested.value)}>toggle</button>
                <Dialog.Close>Close 0</Dialog.Close>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        );
      });

      const { user } = await render(<App />);

      await user.click(screen.getByRole('button', { name: 'Trigger 0' }));

      await waitFor(() => {
        expect(screen.getByTestId('popup0')).not.toBe(null);
      });

      const computedStyles = getComputedStyle(screen.getByTestId('popup0'));

      expect(computedStyles.getPropertyValue('--nested-dialogs')).toBe('0');

      await user.click(screen.getByRole('button', { name: 'toggle' }));

      expect(computedStyles.getPropertyValue('--nested-dialogs')).toBe('0');
    });

    it('increments for nested alert dialog and decrements on close (cross-type)', async () => {
      const { user } = await render(
        <Dialog.Root>
          <Dialog.Trigger>Open Dialog</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup data-testid="parent-dialog">
              <AlertDialog.Root>
                <AlertDialog.Trigger>Open Alert</AlertDialog.Trigger>
                <AlertDialog.Portal>
                  <AlertDialog.Popup data-testid="nested-alert">
                    <AlertDialog.Close>Close Alert</AlertDialog.Close>
                  </AlertDialog.Popup>
                </AlertDialog.Portal>
              </AlertDialog.Root>
              <Dialog.Close>Close Dialog</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>,
      );

      await user.click(screen.getByRole('button', { name: 'Open Dialog' }));
      await waitFor(() => expect(screen.getByTestId('parent-dialog')).not.toBe(null));

      const parent = screen.getByTestId('parent-dialog');
      expect(getComputedStyle(parent).getPropertyValue('--nested-dialogs')).toBe('0');

      await user.click(screen.getByRole('button', { name: 'Open Alert' }));
      await waitFor(() => expect(screen.getByTestId('nested-alert')).not.toBe(null));
      await waitFor(() => {
        expect(getComputedStyle(parent).getPropertyValue('--nested-dialogs')).toBe('1');
      });

      await user.click(screen.getByRole('button', { name: 'Close Alert' }));
      await waitFor(() => {
        expect(getComputedStyle(parent).getPropertyValue('--nested-dialogs')).toBe('0');
      });
    });
  });

  describe('style hooks', () => {
    it('adds the `nested` and `nested-dialog-open` style hooks if a dialog has a parent dialog', async () => {
      await render(
        <Dialog.Root open>
          <Dialog.Portal>
            <Dialog.Popup data-testid="parent-dialog" />
            <Dialog.Root open>
              <Dialog.Portal>
                <Dialog.Popup data-testid="nested-dialog">
                  <Dialog.Root>
                    <Dialog.Portal>
                      <Dialog.Popup />
                    </Dialog.Portal>
                  </Dialog.Root>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </Dialog.Portal>
        </Dialog.Root>,
      );

      const parentDialog = screen.getByTestId('parent-dialog');
      const nestedDialog = screen.getByTestId('nested-dialog');

      expect(parentDialog).not.toHaveAttribute('data-nested');
      expect(nestedDialog).toHaveAttribute('data-nested');

      expect(parentDialog).toHaveAttribute('data-nested-dialog-open');
      expect(nestedDialog).not.toHaveAttribute('data-nested-dialog-open');
    });

    it('adds the `nested` and `nested-dialog-open` style hooks if a dialog has a parent alert dialog', async () => {
      await render(
        <AlertDialog.Root open>
          <AlertDialog.Portal>
            <AlertDialog.Popup data-testid="parent-dialog" />
            <Dialog.Root open>
              <Dialog.Portal>
                <Dialog.Popup data-testid="nested-dialog">
                  <Dialog.Root>
                    <Dialog.Portal>
                      <Dialog.Popup />
                    </Dialog.Portal>
                  </Dialog.Root>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </AlertDialog.Portal>
        </AlertDialog.Root>,
      );

      const parentDialog = screen.getByTestId('parent-dialog');
      const nestedDialog = screen.getByTestId('nested-dialog');

      expect(parentDialog).not.toHaveAttribute('data-nested');
      expect(nestedDialog).toHaveAttribute('data-nested');

      expect(parentDialog).toHaveAttribute('data-nested-dialog-open');
      expect(nestedDialog).not.toHaveAttribute('data-nested-dialog-open');
    });
  });

  describe('modal marks', () => {
    it.each([
      { name: 'a modal dialog', modal: true, inert: true },
      { name: 'a trap-focus dialog', modal: 'trap-focus' as const, inert: false },
    ])('BUG-4678: hides the page outside $name', async ({ modal, inert }) => {
      await render(
        <div>
          <button>Outside</button>
          <Dialog.Root defaultOpen modal={modal}>
            <Dialog.Portal>
              <Dialog.Popup>
                <button>Inside</button>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </div>,
      );

      const outside = screen.getByRole('button', { name: 'Outside', hidden: true });
      await waitFor(() => {
        expect(outside.closest('[aria-hidden="true"]')).not.toBe(null);
      });
      expect(outside.closest('[inert]') !== null).toBe(inert);
      expect(screen.getByRole('button', { name: 'Inside' }).closest('[inert]')).toBe(null);
    });

    // Base UI moves the initial focus to an element outside a modal dialog. That element is inert
    // here, so only the return of the focus is the same.
    it.each([
      { name: 'the trigger', withFinalFocus: false, getFocused: () => screen.getByText('Open') },
      {
        name: 'the element of finalFocus',
        withFinalFocus: true,
        getFocused: () => screen.getByTestId('final-outside'),
      },
    ])(
      'BUG-4678: keeps the initial focus off an inert element, and returns the focus to $name',
      async ({ withFinalFocus, getFocused }) => {
        const TestComponent = defineComponent(() => {
          const initialRef = shallowRef<HTMLInputElement | null>(null);
          const finalRef = shallowRef<HTMLInputElement | null>(null);
          return () => (
            <div>
              <input data-testid="initial-outside" ref={initialRef} />
              <Dialog.Root>
                <Dialog.Trigger>Open</Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Popup
                    initialFocus={initialRef}
                    finalFocus={withFinalFocus ? finalRef : undefined}
                  >
                    <Dialog.Close>Close</Dialog.Close>
                  </Dialog.Popup>
                </Dialog.Portal>
              </Dialog.Root>
              <input data-testid="final-outside" ref={finalRef} />
            </div>
          );
        });
        const { user } = await render(<TestComponent />);
        const initial = screen.getByTestId('initial-outside');

        await user.click(screen.getByText('Open'));
        await waitFor(() => {
          expect(initial.closest('[inert]')).not.toBe(null);
        });
        // The initial focus moves one frame after the DOM update of the open.
        await waitSingleFrame();
        await flushMicrotasks();
        expect(initial).not.toHaveFocus();

        await user.click(screen.getByText('Close'));

        await waitFor(() => {
          expect(getFocused()).toHaveFocus();
        });
      },
    );

    it('releases the marks while KeepAlive holds the dialog, and takes them back after', async () => {
      const show = shallowRef(true);
      const ModalDialog = defineComponent({
        name: 'ModalDialog',
        setup: () => () => (
          <Dialog.Root defaultOpen>
            <Dialog.Portal>
              <Dialog.Popup>
                <button>Inside</button>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        ),
      });
      const Other = defineComponent({ name: 'Other', setup: () => () => <p>other</p> });
      await render(() => (
        <div>
          <button>Outside</button>
          <KeepAlive>{show.value ? <ModalDialog key="dialog" /> : <Other key="other" />}</KeepAlive>
        </div>
      ));
      const outside = screen.getByRole('button', { name: 'Outside', hidden: true });
      await waitFor(() => {
        expect(outside.closest('[inert]')).not.toBe(null);
      });

      show.value = false;
      await flushMicrotasks();
      expect(outside.closest('[inert]')).toBe(null);
      expect(outside.closest('[aria-hidden="true"]')).toBe(null);

      show.value = true;
      await waitFor(() => {
        expect(outside.closest('[inert]')).not.toBe(null);
      });
    });
  });

  describe('focus', () => {
    it.each([
      { name: 'by default', disablePointerDismissal: false, open: false },
      { name: 'with disablePointerDismissal', disablePointerDismissal: true, open: true },
    ])(
      'closes a non-modal dialog when the focus leaves it $name',
      async ({ disablePointerDismissal, open }) => {
        const { user } = await render(
          <div>
            <Dialog.Root
              defaultOpen
              modal={false}
              disablePointerDismissal={disablePointerDismissal}
            >
              <Dialog.Portal>
                <Dialog.Popup>
                  <button>Inside</button>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
            <button>Outside</button>
          </div>,
        );
        await waitFor(() => {
          expect(screen.getByRole('button', { name: 'Inside' })).toHaveFocus();
        });

        await user.keyboard('[Tab]');
        await waitFor(() => {
          expect(screen.getByRole('button', { name: 'Outside' })).toHaveFocus();
        });
        await flushMicrotasks();

        expect(screen.queryByRole('dialog') !== null).toBe(open);
      },
    );

    it('moves the focus to the popup when the focused element in it goes away', async () => {
      const App = defineComponent(() => {
        const showButton = shallowRef(true);
        return () => (
          <Dialog.Root defaultOpen modal={false}>
            <Dialog.Portal>
              <Dialog.Popup data-testid="popup">
                {showButton.value && (
                  <button onClick={() => (showButton.value = false)}>Remove</button>
                )}
                <input />
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        );
      });
      const { user } = await render(<App />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Remove' })).toHaveFocus();
      });

      await user.click(screen.getByRole('button', { name: 'Remove' }));

      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveFocus();
      });
    });
  });

  it('stops the arrow, Home and End keys at the popup', async () => {
    const handleKeydown = vi.fn();
    await render(
      <Dialog.Root open modal={false}>
        <Dialog.Portal>
          <Dialog.Popup data-testid="popup" />
        </Dialog.Portal>
      </Dialog.Root>,
    );
    document.addEventListener('keydown', handleKeydown);
    const popup = screen.getByTestId('popup');

    try {
      for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']) {
        await fireEvent.keyDown(popup, { key });
      }
      expect(handleKeydown).not.toHaveBeenCalled();

      await fireEvent.keyDown(popup, { key: 'a' });
      expect(handleKeydown).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener('keydown', handleKeydown);
    }
  });

  // The compiled template of the fixture mounts the new popup before it unmounts the old popup. A
  // render function in TSX reuses the popup component, so it does not show this order.
  it('keeps the element of the new popup in the store when a template replaces the popup', async () => {
    let store!: DialogStore<unknown>;
    const { setProps } = await render(
      <DialogPopupReplacement first onStore={(value) => (store = value)} />,
    );
    expect(store.select('popupElement')).toBe(screen.getByTestId('first'));

    await setProps({ first: false });

    const popup = screen.getByTestId('second');
    expect(store.select('popupElement')).toBe(popup);
    expect(store.context.popupRef.value).toBe(popup);
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case of the file then gets a warning about a slot.
  it('throws a descriptive error when rendered outside <Dialog.Root>', async () => {
    await expect(render(<Dialog.Popup />)).rejects.toThrow(
      'Vase UI: DialogRootContext is missing. Without it a Dialog part has no dialog to read. Put the Dialog parts inside <Dialog.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
