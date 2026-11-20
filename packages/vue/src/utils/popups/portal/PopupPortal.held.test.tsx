import { describe, expect, it } from 'vitest';
import {
  createHeldBranch,
  createRenderer,
  nextEvent,
  screen,
  waitForLaterMillisecond,
  waitSingleFrame,
} from '#test-utils';
import { Autocomplete } from '@vase-ui/vue/autocomplete';
import { Combobox } from '@vase-ui/vue/combobox';
import { ContextMenu } from '@vase-ui/vue/context-menu';
import { Menu } from '@vase-ui/vue/menu';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import { PreviewCard } from '@vase-ui/vue/preview-card';
import { Select } from '@vase-ui/vue/select';
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

function renderSelect() {
  return (
    <Select.Root defaultOpen defaultValue="one">
      <Select.Trigger data-testid="trigger">
        <Select.Value />
      </Select.Trigger>
      <Select.Portal data-testid="portal">
        <Select.Positioner>
          <Select.Popup data-testid="popup">
            <Select.Item value="one">One</Select.Item>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

// The place of the popup against its trigger, after the positioner has had frames to place it.
async function measurePopupOffset() {
  for (let frame = 0; frame < 5; frame += 1) {
    await waitSingleFrame();
  }
  const trigger = screen.getByTestId('trigger').getBoundingClientRect();
  const popup = screen.getByTestId('popup').getBoundingClientRect();
  return { left: popup.left - trigger.left, top: popup.top - trigger.top };
}

const families = [
  {
    name: 'Menu',
    renderPart: () => (
      <Menu.Root defaultOpen>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal data-testid="portal">
          <Menu.Positioner>
            <Menu.Popup data-testid="popup">
              <Menu.Item>One</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ),
    marksPage: true,
    movesFocus: true,
  },
  {
    name: 'ContextMenu',
    renderPart: () => (
      <ContextMenu.Root defaultOpen>
        <ContextMenu.Trigger>Area</ContextMenu.Trigger>
        <ContextMenu.Portal data-testid="portal">
          <ContextMenu.Positioner>
            <ContextMenu.Popup data-testid="popup">
              <ContextMenu.Item>One</ContextMenu.Item>
            </ContextMenu.Popup>
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ),
    marksPage: true,
    movesFocus: true,
  },
  {
    name: 'Select',
    renderPart: renderSelect,
    marksPage: true,
    movesFocus: true,
  },
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
    name: 'PreviewCard',
    renderPart: () => (
      <PreviewCard.Root defaultOpen>
        <PreviewCard.Trigger href="#card">Link</PreviewCard.Trigger>
        <PreviewCard.Portal data-testid="portal">
          <PreviewCard.Positioner>
            <PreviewCard.Popup data-testid="popup">Card</PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ),
    marksPage: false,
    movesFocus: false,
  },
  {
    name: 'NavigationMenu',
    renderPart: () => (
      <NavigationMenu.Root defaultValue="one">
        <NavigationMenu.List>
          <NavigationMenu.Item value="one">
            <NavigationMenu.Trigger>One</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#one">Link of one</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
        <NavigationMenu.Portal data-testid="portal">
          <NavigationMenu.Positioner>
            <NavigationMenu.Popup data-testid="popup">
              <NavigationMenu.Viewport />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>
    ),
    marksPage: false,
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

  it('a select that mounts while its branch is held has the place of a select that mounts in a shown branch', async () => {
    const held = createHeldBranch(renderSelect);
    const { unmount } = await render(
      <div>
        <button data-testid="outside">Outside</button>
        <held.HeldBranch />
      </div>,
    );
    await held.mountWhileHeld();
    await waitForLaterMillisecond(() => held.show());
    const afterShow = await measurePopupOffset();
    unmount();

    await render(
      <div>
        <button data-testid="outside">Outside</button>
        <div>{renderSelect()}</div>
      </div>,
    );
    const shownMount = await measurePopupOffset();

    expect(afterShow).toEqual(shownMount);
  });
});
