import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import {
  createHeldBranch,
  createRenderer,
  flushMicrotasks,
  isVaporApp,
  nextEvent,
  screen,
  waitForLaterMillisecond,
  waitSingleFrame,
} from '#test-utils';
import { AlertDialog } from '@vase-ui/vue/alert-dialog';
import { Autocomplete } from '@vase-ui/vue/autocomplete';
import { Combobox } from '@vase-ui/vue/combobox';
import { ContextMenu } from '@vase-ui/vue/context-menu';
import { Dialog } from '@vase-ui/vue/dialog';
import { Drawer } from '@vase-ui/vue/drawer';
import { Menu } from '@vase-ui/vue/menu';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import { PreviewCard } from '@vase-ui/vue/preview-card';
import { Select } from '@vase-ui/vue/select';
import { Toast } from '@vase-ui/vue/toast';
import VaporHeldBranch from './VaporHeldBranch.test.vue';

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

function renderDialog() {
  return (
    <Dialog.Root defaultOpen>
      <Dialog.Portal data-testid="portal">
        <Dialog.Popup data-testid="popup">
          <button>Inside</button>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
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
    name: 'Dialog',
    renderPart: renderDialog,
    marksPage: true,
    movesFocus: true,
  },
  {
    name: 'AlertDialog',
    renderPart: () => (
      <AlertDialog.Root defaultOpen>
        <AlertDialog.Portal data-testid="portal">
          <AlertDialog.Popup data-testid="popup">
            <button>Inside</button>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    ),
    marksPage: true,
    movesFocus: true,
  },
  {
    name: 'Drawer',
    renderPart: () => (
      <Drawer.Root defaultOpen>
        <Drawer.Portal data-testid="portal">
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <button>Inside</button>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ),
    marksPage: true,
    movesFocus: true,
  },
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

  it('a dialog whose root mounts in the flush that shows its branch locks the scroll, marks the page and takes the focus', async () => {
    const { HeldBranch, hide, mountInActivation } = createHeldBranch(renderDialog);
    const { container } = await render(
      <div>
        <button data-testid="outside">Outside</button>
        <HeldBranch />
      </div>,
    );
    screen.getByTestId('outside').focus();
    await hide();

    await nextEvent(document, 'focusin', { action: mountInActivation });

    const popup = screen.getByTestId('popup');
    expect(screen.getByTestId('portal').parentElement).toBe(document.body);
    expect(popup.contains(document.activeElement)).toBe(true);
    expect(isMarked(container)).toBe(true);
  });

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

  // Only the project `vapor` renders a Vapor component. There the `KeepAlive` of the fixture is the
  // `KeepAlive` of Vapor.
  it.runIf(isVaporApp)(
    'a dialog below the KeepAlive of a Vapor component stays out of the document until the branch shows',
    async () => {
      expect((VaporHeldBranch as { __vapor?: boolean }).__vapor).toBe(true);
      const visible = shallowRef(true);
      const mounted = shallowRef(false);
      const { container } = await render(
        <div>
          <button data-testid="outside">Outside</button>
          <VaporHeldBranch
            visible={visible}
            mounted={mounted}
            part={defineComponent(() => renderDialog)}
          />
        </div>,
      );
      const outside = screen.getByTestId('outside');
      outside.focus();

      visible.value = false;
      await flushMicrotasks();
      mounted.value = true;
      await flushMicrotasks();
      await waitPastFocusFrame();

      expect(document.querySelector('[data-vase-ui-portal]')).toBe(null);
      expect(getMarkedChildrenOfBody()).toEqual([]);
      expect(outside).toHaveFocus();

      await nextEvent(document, 'focusin', {
        action: async () => {
          visible.value = true;
          await flushMicrotasks();
        },
      });

      const popup = screen.getByTestId('popup');
      expect(screen.getByTestId('portal').parentElement).toBe(document.body);
      expect(popup.contains(document.activeElement)).toBe(true);
      expect(isMarked(container)).toBe(true);
    },
  );

  it('a nested dialog does not set data-nested-dialog-open on the dialog above', async () => {
    const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() => (
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Popup data-testid="child">
            <button>Child</button>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));
    await render(
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Popup data-testid="parent">
            <button>Parent</button>
            <HeldBranch />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>,
    );
    const parent = screen.getByTestId('parent');

    await mountWhileHeld();

    expect(parent).not.toHaveAttribute('data-nested-dialog-open');

    await show();

    expect(parent).toHaveAttribute('data-nested-dialog-open');
  });

  it('a drawer does not activate Drawer.Indent', async () => {
    const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() => (
      <Drawer.Root defaultOpen>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup>
              <button>Inside</button>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));
    await render(
      <Drawer.Provider>
        <Drawer.Indent data-testid="indent">
          <HeldBranch />
        </Drawer.Indent>
      </Drawer.Provider>,
    );
    const indent = screen.getByTestId('indent');

    await mountWhileHeld();

    expect(indent).not.toHaveAttribute('data-active');

    await show();

    expect(indent).toHaveAttribute('data-active');
  });

  it('a nested drawer does not report its presence to the drawer above', async () => {
    const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() => (
      <Drawer.Root defaultOpen>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="child">
              <button>Child</button>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));
    await render(
      <Drawer.Root defaultOpen>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="parent">
              <button>Parent</button>
              <HeldBranch />
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );
    const parent = screen.getByTestId('parent');

    await mountWhileHeld();

    expect(parent.style.getPropertyValue('--drawer-height')).toBe('');

    await show();

    expect(parent.style.getPropertyValue('--drawer-height')).toBe(`${parent.offsetHeight}px`);
  });

  it('a drawer viewport adds no non-passive touchmove listener to the document', async () => {
    const addEventListener = vi.spyOn(document, 'addEventListener');
    onTestFinished(() => {
      addEventListener.mockRestore();
    });
    const countTouchMoveListeners = () =>
      addEventListener.mock.calls.filter(
        ([type, , options]) =>
          type === 'touchmove' && typeof options === 'object' && options.passive === false,
      ).length;
    const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() => (
      <Drawer.Root defaultOpen>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup>
              <button>Inside</button>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));
    await render(<HeldBranch />);

    await mountWhileHeld();

    expect(countTouchMoveListeners()).toBe(0);

    await show();

    expect(countTouchMoveListeners()).toBe(1);
  });
});
