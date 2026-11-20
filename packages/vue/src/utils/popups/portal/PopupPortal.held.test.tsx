import { describe, expect, it } from 'vitest';
import { createHeldBranch, createRenderer, nextEvent, screen, waitSingleFrame } from '#test-utils';
import { Autocomplete } from '@vase-ui/vue/autocomplete';
import { Combobox } from '@vase-ui/vue/combobox';
import { Toast } from '@vase-ui/vue/toast';

function isMarked(element: Element) {
  return (
    element.hasAttribute('inert') ||
    element.getAttribute('aria-hidden') === 'true' ||
    element.hasAttribute('data-vase-ui-inert')
  );
}

function getMarkedChildrenOfBody() {
  return Array.from(document.body.children).filter(isMarked);
}

// A popup that mounts in a shown branch has the focus at most one frame after the mount. A held
// case waits two frames before it asserts that the focus did not move.
async function waitPastFocusFrame() {
  await waitSingleFrame();
  await waitSingleFrame();
}

const families = [
  {
    name: 'Combobox',
    renderPart: () => (
      <Combobox.Root defaultOpen items={['one']}>
        <Combobox.Input />
        <Combobox.Portal data-testid="portal">
          <Combobox.Positioner>
            <Combobox.Popup data-testid="popup">
              <Combobox.List>
                <Combobox.Item value="one">One</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ),
    marksPage: true,
    movesFocus: false,
  },
  {
    name: 'Autocomplete',
    renderPart: () => (
      <Autocomplete.Root defaultOpen items={['one']}>
        <Autocomplete.Input />
        <Autocomplete.Portal data-testid="portal">
          <Autocomplete.Positioner>
            <Autocomplete.Popup data-testid="popup">
              <Autocomplete.List>
                <Autocomplete.Item value="one">One</Autocomplete.Item>
              </Autocomplete.List>
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>
    ),
    marksPage: true,
    movesFocus: false,
  },
  {
    name: 'Toast',
    renderPart: () => (
      <Toast.Provider>
        <Toast.Portal data-testid="portal">
          <Toast.Viewport data-testid="popup" />
        </Toast.Portal>
      </Toast.Provider>
    ),
    marksPage: false,
    movesFocus: false,
  },
];

describe('VUE-5: a popup whose root mounts while KeepAlive holds its branch', () => {
  const { render } = createRenderer();

  it.each(families)(
    '$name stays out of the document and takes nothing until the branch shows',
    async ({ renderPart, marksPage, movesFocus }) => {
      const { HeldBranch, mountWhileHeld, show, hide } = createHeldBranch(renderPart);
      const { container, user } = await render(
        <div>
          <button data-testid="outside">Outside</button>
          <HeldBranch />
        </div>,
      );
      const outside = screen.getByTestId('outside');
      outside.focus();

      await mountWhileHeld();
      await waitPastFocusFrame();

      expect(document.querySelector('[data-vase-ui-portal]')).toBe(null);
      expect(screen.queryByTestId('popup')).toBe(null);
      expect(getMarkedChildrenOfBody()).toEqual([]);
      expect(outside).toHaveFocus();

      // The popup did not show, so a press outside it must not close it.
      await user.click(outside);
      if (movesFocus) {
        await nextEvent(document, 'focusin', { action: show });
      } else {
        await show();
      }

      const popup = screen.getByTestId('popup');
      const portal = screen.getByTestId('portal');
      expect(portal.parentElement).toBe(document.body);
      expect(portal).toContainElement(popup);
      expect(isMarked(container)).toBe(marksPage);
      expect(popup.contains(document.activeElement)).toBe(movesFocus);

      await hide();
      expect(getMarkedChildrenOfBody()).toEqual([]);
    },
  );
});
