import { describe, expect, it, vi } from 'vitest';
import { defineComponent, KeepAlive, shallowRef } from 'vue';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  isInaccessible,
  nextAnimationsRead,
  nextEvent,
  screen,
  waitFor,
} from '#test-utils';
import ComboboxTriggerPart from '../../../test/fixtures/ComboboxTriggerPart.vue';
import * as Combobox from '../index.parts';

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

  describe('the focus', () => {
    function renderWithInputInPopup() {
      return render(
        <Combobox.Root>
          <ComboboxTriggerPart data-testid="trigger">Open</ComboboxTriggerPart>
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
      await fireEvent.click(trigger, { detail: 1 });

      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveFocus();
      });
    });

    it('returns to the trigger when the popup with the input closes', async () => {
      const { user } = await renderWithInputInPopup();
      await user.click(screen.getByTestId('trigger'));
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

  it('emits openChangeComplete with true when the popup has opened', async () => {
    const handleOpenChangeComplete = vi.fn();
    const { user } = await render(
      <Combobox.Root onOpenChangeComplete={handleOpenChangeComplete}>
        <ComboboxTriggerPart data-testid="trigger">Open</ComboboxTriggerPart>
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
    const EXIT_CSS = `
      .popup[data-ending-style] { animation: popup-exit 100s; }
      @keyframes popup-exit { to { opacity: 0; } }
    `;

    // An element that the Tab key can reach, under `aria-hidden` on itself or on an ancestor.
    function getFocusableUnderAriaHidden() {
      return [...document.querySelectorAll<HTMLElement>('[aria-hidden="true"]')]
        .flatMap((element) => [element, ...element.querySelectorAll<HTMLElement>('*')])
        .filter((element) => element.tabIndex >= 0);
    }

    it.each([
      { name: 'an input in the popup', inputInPopup: true },
      { name: 'an input outside the popup', inputInPopup: false },
    ])(
      'BUG-5519: keeps no focusable content under aria-hidden during the exit ($name)',
      async ({ inputInPopup }) => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
        const open = shallowRef(true);
        await render(() => (
          <div>
            <style>{EXIT_CSS}</style>
            <button type="button">Outside</button>
            <Combobox.Root open={open.value}>
              {inputInPopup ? null : <Combobox.Input />}
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup class="popup" data-testid="popup">
                    {inputInPopup ? <Combobox.Input /> : null}
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </div>
        ));
        await waitFor(() => {
          expect(getFocusableUnderAriaHidden().length).toBeGreaterThan(0);
        });
        const popup = screen.getByTestId('popup');
        const animationsRead = nextAnimationsRead(popup);

        await nextEvent(popup, 'animationstart', {
          action: () => {
            open.value = false;
          },
        });
        const focusableDuringExit = getFocusableUnderAriaHidden();
        for (const animation of await animationsRead) {
          animation.finish();
        }
        await waitFor(() => {
          expect(popup.isConnected).toBe(false);
        });

        expect(focusableDuringExit).toEqual([]);
      },
    );
  });
});
