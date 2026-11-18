import { describe, expect, it, vi } from 'vitest';
import { defineComponent, KeepAlive, shallowRef } from 'vue';
import { Combobox } from '@vase-ui/vue/combobox';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  getFocusableUnderAriaHidden,
  isInaccessible,
  nextEvent,
  POPUP_EXIT_CSS,
  screen,
  waitFor,
  waitForLaterMillisecond,
} from '#test-utils';
import { FocusAtMount } from '../../../test/fixtures/FocusAtMount';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import type { ComboboxStore } from '../store';

describe('<Combobox.Popup />', () => {
  const { render } = createRenderer();

  describeConformance(<Combobox.Popup />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(
        <Combobox.Root open>
          <Combobox.Portal>
            <Combobox.Positioner>{node}</Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));

  it('exposes open state via data attributes mapping', async () => {
    await render(
      <Combobox.Root defaultOpen>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-testid="popup" />
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const popup = await screen.findByTestId('popup');
    expect(popup).toHaveAttribute('data-open');
  });

  it('sets role to presentation when input renders outside the popup', async () => {
    await render(
      <Combobox.Root defaultOpen items={['Apple']}>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-testid="popup" />
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const popup = await screen.findByTestId('popup');
    await waitFor(() => {
      expect(popup).toHaveAttribute('role', 'presentation');
    });
  });

  it('sets role to dialog when input renders inside the popup', async () => {
    await render(
      <Combobox.Root defaultOpen items={['Apple']}>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-testid="popup">
              <Combobox.Input />
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const popup = await screen.findByTestId('popup');
    await waitFor(() => {
      expect(popup).toHaveAttribute('role', 'dialog');
    });
  });

  it('focuses the popup instead of its input when opened by touch', async () => {
    await render(
      <Combobox.Root>
        <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-testid="popup">
              <Combobox.Input data-testid="input" />
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    await fireEvent.pointerDown(trigger, { pointerType: 'touch' });
    await fireEvent.mouseDown(trigger);

    await waitFor(() => {
      expect(screen.getByTestId('popup')).toHaveFocus();
    });
    expect(screen.getByTestId('input')).not.toHaveFocus();
  });

  it('honors initialFocus={false}', async () => {
    await render(
      <Combobox.Root>
        <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup initialFocus={false}>
              <Combobox.Input data-testid="input" />
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    await fireEvent.click(trigger);

    await screen.findByTestId('input');
    expect(trigger).toHaveFocus();
  });

  it('passes the close type of an item press to a finalFocus function', async () => {
    const finalFocus = vi.fn(() => false);

    const { user } = await render(
      <Combobox.Root>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup finalFocus={finalFocus}>
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
                <Combobox.Item value="b">b</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = screen.getByTestId('input');

    const option = await waitForLaterMillisecond(async () => {
      await user.click(input);
      return screen.findByRole('option', { name: 'a' });
    });
    // user-event's synthetic clicks carry no pointer type, so the mouse press is dispatched
    // directly.
    await fireEvent.pointerDown(option, { pointerType: 'mouse' });
    await fireEvent.click(option, { detail: 1 });
    expect(screen.queryByRole('listbox')).toBe(null);
    expect(finalFocus).toHaveBeenLastCalledWith('mouse');

    input.focus();
    await flushMicrotasks();
    await waitForLaterMillisecond(async () => {
      await user.keyboard('{ArrowDown}');
      await screen.findByRole('listbox');
    });
    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.queryByRole('listbox')).toBe(null);
    expect(finalFocus).toHaveBeenLastCalledWith('keyboard');
  });

  it('returns focus to an explicitly provided element when the popup closes', async () => {
    const Test = defineComponent(() => {
      const finalFocus = shallowRef<HTMLButtonElement | null>(null);
      return () => (
        <div>
          <button ref={finalFocus} type="button">
            final focus
          </button>
          <Combobox.Root defaultOpen>
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup finalFocus={finalFocus}>
                  <Combobox.List>
                    <Combobox.Item value="a">a</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </div>
      );
    });

    const { user } = await render(<Test />);
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'final focus' })).toHaveFocus();
    });
  });

  describe('the id of the popup in the store', () => {
    const Probe = defineComponent(() => {
      const store = useComboboxRootContext();
      return () => <span data-testid="probe" data-popup-id={store.select('popupId')} />;
    });

    it('gives the rendered id of the popup to the store', async () => {
      const id = shallowRef<string | undefined>(undefined);
      await render(() => (
        <Combobox.Root defaultOpen>
          <Probe />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup data-testid="popup" {...(id.value ? { id: id.value } : {})}>
                <Combobox.Input />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));
      await flushMicrotasks();
      const popupId = screen.getByTestId('popup').id;
      expect(popupId).not.toBe('');
      expect(screen.getByTestId('probe')).toHaveAttribute('data-popup-id', popupId);

      id.value = 'fruits';
      await flushMicrotasks();

      expect(screen.getByTestId('probe')).toHaveAttribute('data-popup-id', 'fruits');
    });

    it('gives the new id of the popup to the store when the id of the root changes', async () => {
      // A component with no props does not render again with its parent. The popup part thus
      // renders again only for a value that its own render reads.
      const PopupParts = defineComponent(() => () => (
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-testid="popup">
              <Combobox.Input />
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      ));
      const rootId = shallowRef('first');
      await render(() => (
        <Combobox.Root defaultOpen id={rootId.value}>
          <Probe />
          <PopupParts />
        </Combobox.Root>
      ));
      await flushMicrotasks();
      const firstPopupId = screen.getByTestId('popup').id;
      expect(screen.getByTestId('probe')).toHaveAttribute('data-popup-id', firstPopupId);

      rootId.value = 'second';
      await flushMicrotasks();

      const secondPopupId = screen.getByTestId('popup').id;
      expect(secondPopupId).not.toBe(firstPopupId);
      expect(screen.getByTestId('probe')).toHaveAttribute('data-popup-id', secondPopupId);
    });
  });

  describe('the dismiss button after the popup', () => {
    let store!: ComboboxStore;
    const StoreProbe = defineComponent(() => {
      store = useComboboxRootContext();
      return () => null;
    });

    it('gives the dismiss button after the popup to the store', async () => {
      await render(
        <Combobox.Root defaultOpen>
          <StoreProbe />
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup data-testid="popup" />
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );
      const popup = await screen.findByTestId('popup');

      await waitFor(() => {
        expect(store.context.endDismissRef.value).toBe(popup.nextElementSibling);
      });
      expect(store.context.endDismissRef.value).toHaveAttribute('aria-label', 'Dismiss');
    });

    it('keeps the dismiss button between the popup and its last inside guard', async () => {
      await render(
        <Combobox.Root defaultOpen modal>
          <StoreProbe />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup data-testid="popup">
                <Combobox.Input />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );
      const popup = await screen.findByTestId('popup');

      await waitFor(() => {
        expect(store.context.endDismissRef.value).toBe(popup.nextElementSibling);
      });
      expect(popup.previousElementSibling).toHaveAttribute('data-type', 'inside');
      expect(popup.nextElementSibling?.nextElementSibling).toHaveAttribute('data-type', 'inside');
    });

    it('renders no dismiss button after a popup that holds the input and is not modal', async () => {
      await render(
        <Combobox.Root defaultOpen>
          <StoreProbe />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup data-testid="popup">
                <Combobox.Input />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );
      await screen.findByTestId('popup');
      await flushMicrotasks();

      expect(screen.queryAllByRole('button', { name: 'Dismiss', hidden: true })).toEqual([]);
      expect(store.context.endDismissRef.value).toBe(null);
    });
  });

  describe('the focus', () => {
    function renderWithInputInPopup() {
      return render(
        <Combobox.Root>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup data-testid="popup">
                <button type="button">Before</button>
                <Combobox.Input data-testid="input" />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );
    }

    it('BUG-6037: returns focus to the trigger after a field takes focus at mount', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const open = shallowRef(false);
      const onOpenChangeComplete = vi.fn();
      await render(() => (
        <div>
          <style>{POPUP_EXIT_CSS}</style>
          <button>Before</button>
          <Combobox.Root open={open.value} onOpenChangeComplete={onOpenChangeComplete}>
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup class="popup" data-testid="popup">
                  <Combobox.Input />
                  <FocusAtMount data-testid="field" />
                  <Combobox.List>
                    <Combobox.Item value="one">One</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </div>
      ));
      const trigger = screen.getByTestId('trigger');
      screen.getByRole('button', { name: 'Before' }).focus();
      open.value = true;
      await waitFor(() => expect(onOpenChangeComplete).toHaveBeenCalledWith(true));
      expect(screen.getByTestId('field')).toHaveFocus();

      const popup = screen.getByTestId('popup');
      let focusAtExitStart: Element | null = null;
      popup.addEventListener(
        'animationstart',
        () => {
          focusAtExitStart = document.activeElement;
        },
        { once: true },
      );
      await nextEvent(popup, 'animationstart', {
        action: () => {
          open.value = false;
        },
      });
      const animations = popup.getAnimations();
      const finished = animations.map((animation) => animation.finished);
      for (const animation of animations) {
        animation.finish();
      }
      await Promise.all(finished);
      await flushMicrotasks();
      expect(screen.queryByTestId('popup')).toBe(null);
      expect(focusAtExitStart).toBe(trigger);
      expect(trigger).toHaveFocus();
    });

    it('moves to the input in the popup when the popup opens', async () => {
      const { user } = await renderWithInputInPopup();

      await user.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        expect(screen.getByTestId('input')).toHaveFocus();
      });
    });

    it('moves to the popup and not to its input when a touch opens the popup', async () => {
      await renderWithInputInPopup();
      const trigger = screen.getByTestId('trigger');

      await fireEvent.pointerDown(trigger, { pointerType: 'touch' });
      await fireEvent.mouseDown(trigger);
      await fireEvent.click(trigger, { detail: 1 });

      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveFocus();
      });
    });

    it('returns to the trigger when the popup with the input closes', async () => {
      const { user } = await renderWithInputInPopup();
      await waitForLaterMillisecond(async () => {
        await user.click(screen.getByTestId('trigger'));
        await screen.findByTestId('input');
      });
      await waitFor(() => {
        expect(screen.getByTestId('input')).toHaveFocus();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.getByTestId('trigger')).toHaveFocus();
      });
    });

    it('moves to the finalFocus element when the popup closes', async () => {
      const Test = defineComponent(() => {
        const finalFocus = shallowRef<HTMLButtonElement | null>(null);
        return () => (
          <div>
            <button ref={finalFocus} type="button">
              final focus
            </button>
            <Combobox.Root defaultOpen>
              <Combobox.Input />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup finalFocus={finalFocus} />
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </div>
        );
      });
      const { user } = await render(<Test />);

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'final focus' })).toHaveFocus();
      });
    });

    it('moves to the input when the popup itself gets the focus', async () => {
      await render(
        <Combobox.Root defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup data-testid="popup" tabindex={-1} />
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );
      await flushMicrotasks();

      screen.getByTestId('popup').focus();

      await waitFor(() => {
        expect(screen.getByTestId('input')).toHaveFocus();
      });
    });
  });

  it('keeps the dismiss buttons out of the aria-hidden marks', async () => {
    await render(
      <div>
        <span data-testid="outside">Outside</span>
        <Combobox.Root defaultOpen>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup />
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </div>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('outside')).toHaveAttribute('aria-hidden', 'true');
    });

    const dismissButtons = screen.getAllByRole('button', { name: 'Dismiss', hidden: true });
    expect(dismissButtons).toHaveLength(2);
    expect(dismissButtons.map((button) => isInaccessible(button))).toEqual([false, false]);
  });

  it('hides the content outside a modal popup that holds the input', async () => {
    await render(
      <div>
        <span data-testid="outside">Outside</span>
        <Combobox.Root defaultOpen modal>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </div>,
    );

    await waitFor(() => {
      expect(isInaccessible(screen.getByTestId('outside'))).toBe(true);
    });
  });

  it('emits openChangeComplete with true when the popup has opened', async () => {
    const handleOpenChangeComplete = vi.fn();
    const { user } = await render(
      <Combobox.Root onOpenChangeComplete={handleOpenChangeComplete}>
        <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.Input />
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    await user.click(screen.getByTestId('trigger'));

    await waitFor(() => {
      expect(handleOpenChangeComplete).toHaveBeenCalledWith(true);
    });
  });

  it('releases the aria-hidden marks while KeepAlive holds it, and takes them back', async () => {
    const shown = shallowRef(true);
    await render(() => (
      <div>
        <button type="button" data-testid="outside">
          Outside
        </button>
        <KeepAlive>
          {shown.value ? (
            <Combobox.Root key="root" defaultOpen>
              <Combobox.Input />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup />
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          ) : null}
        </KeepAlive>
      </div>
    ));
    const outside = screen.getByTestId('outside');
    await waitFor(() => {
      expect(outside).toHaveAttribute('aria-hidden', 'true');
    });

    shown.value = false;
    await flushMicrotasks();

    expect(outside).not.toHaveAttribute('aria-hidden');

    shown.value = true;
    await waitFor(() => {
      expect(outside).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('BUG-5519: an exit animation', () => {
    function getFocusGuards() {
      return [...document.querySelectorAll<HTMLElement>('[data-vase-ui-focus-guard]')];
    }

    // Opens the popup with its trigger and closes it with the Escape key. The callback records the
    // document when the exit animation starts. The function resolves after the exit ends. A press
    // of the trigger keeps the content of the popup mounted for typeahead, so the positioner then
    // stays in the DOM and is hidden.
    async function recordExit(record: () => void) {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const { user } = await render(
        <div>
          <style>{POPUP_EXIT_CSS}</style>
          <Combobox.Root>
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner data-testid="positioner">
                <Combobox.Popup class="popup" data-testid="popup">
                  <Combobox.Input data-testid="input" />
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </div>,
      );
      await waitForLaterMillisecond(async () => {
        await user.click(screen.getByTestId('trigger'));
        await screen.findByTestId('input');
      });
      await waitFor(() => {
        expect(screen.getByTestId('input')).toHaveFocus();
      });
      // A focus guard has `aria-hidden`, except in WebKit on an Apple system, where it is a button.
      expect(getFocusGuards().length).toBeGreaterThan(0);
      const popup = screen.getByTestId('popup');

      await nextEvent(popup, 'animationstart', { action: () => user.keyboard('{Escape}') });
      record();
      // The read of the open can come after the wait for the focus, and `nextAnimationsRead` would
      // resolve with it. The animation of 100 s still runs after `animationstart`, so the case reads
      // the list itself.
      const animations = popup.getAnimations();
      for (const animation of animations) {
        animation.finish();
      }
      // A busy machine can stall the page for some seconds, so the wait for the end of the
      // animations has no time limit.
      await Promise.all(animations.map((animation) => animation.finished));
      await waitFor(() => {
        expect(screen.getByTestId('positioner')).toHaveAttribute('hidden');
      });
    }

    it('BUG-5519: keeps no focusable content under aria-hidden during the exit animation', async () => {
      let focusableDuringExit: HTMLElement[] = [];
      let guardsDuringExit: HTMLElement[] = [];

      await recordExit(() => {
        focusableDuringExit = getFocusableUnderAriaHidden();
        guardsDuringExit = getFocusGuards();
      });

      expect(focusableDuringExit).toEqual([]);
      expect(guardsDuringExit).toEqual([]);
    });

    it('BUG-5519: returns the focus to the trigger when the exit animation starts', async () => {
      let focusedDuringExit: Element | null = null;

      await recordExit(() => {
        focusedDuringExit = document.activeElement;
      });

      expect(focusedDuringExit).toBe(screen.getByTestId('trigger'));
    });
  });
});
