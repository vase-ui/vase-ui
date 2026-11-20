import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { defineAsyncComponent } from 'vue';
import type { DefineComponent, VNode } from 'vue';
import { createRenderer, fireEvent, flushMicrotasks, screen, waitFor } from '#test-utils';
import * as AlertDialog from '../../../alert-dialog/index.parts';
import * as Combobox from '../../../combobox/index.parts';
import * as Dialog from '../../../dialog/index.parts';
import * as Drawer from '../../../drawer/index.parts';
import * as Menu from '../../../menu/index.parts';
import * as NavigationMenu from '../../../navigation-menu/index.parts';
import * as Popover from '../../../popover/parts';
import * as PreviewCard from '../../../preview-card/index.parts';
import * as Select from '../../../select/index.parts';
import * as Tooltip from '../../../tooltip/index.parts';

type Change = [open: boolean, reason: string];
type Recorder = (open: boolean, details: { reason: string }) => void;

function recordInto(changes: Change[]): Recorder {
  return (open, details) => {
    changes.push([open, details.reason]);
  };
}

async function press(target: Element) {
  await fireEvent.pointerDown(target, { button: 0, buttons: 1, pointerType: 'mouse' });
  await fireEvent.mouseDown(target, { button: 0, buttons: 1 });
  await fireEvent.pointerUp(target, { button: 0, buttons: 0, pointerType: 'mouse' });
  await fireEvent.mouseUp(target, { button: 0, buttons: 0 });
  await fireEvent.click(target, { button: 0 });
}

// The popup above decides for a mouse press on `click`, or on `pointerdown` for a popover with
// `modal="trap-focus"`. A menu, a select and a combobox close on `pointerdown`, and their backdrops
// leave the document before the `click`. Only the second kind of parent gets a press on them.
const parents = {
  popover: (record: Recorder, content: VNode) => (
    <Popover.Root defaultOpen onOpenChange={record}>
      <Popover.Trigger>Parent trigger</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup initialFocus={false}>{content}</Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  ),
  trapFocusPopover: (record: Recorder, content: VNode) => (
    <Popover.Root defaultOpen modal="trap-focus" onOpenChange={record}>
      <Popover.Trigger>Parent trigger</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup initialFocus={false}>{content}</Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  ),
  dialog: (record: Recorder, content: VNode) => (
    <Dialog.Root defaultOpen modal={false} onOpenChange={record}>
      <Dialog.Portal>
        <Dialog.Popup initialFocus={false}>{content}</Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  ),
};

// Each child is open at the mount. The cases press the parts that have a test id.
const children = {
  dialog: (record: Recorder) => (
    <Dialog.Root defaultOpen onOpenChange={record}>
      <Dialog.Portal>
        <Dialog.Backdrop data-testid="backdrop" />
        <Dialog.Viewport data-testid="viewport">
          <Dialog.Popup data-testid="popup" initialFocus={false} />
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  ),
  alertDialog: (record: Recorder) => (
    <AlertDialog.Root defaultOpen onOpenChange={record}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop data-testid="backdrop" />
        <AlertDialog.Popup data-testid="popup" initialFocus={false} />
      </AlertDialog.Portal>
    </AlertDialog.Root>
  ),
  drawer: (record: Recorder) => (
    <Drawer.Root defaultOpen onOpenChange={record}>
      <Drawer.Portal>
        <Drawer.Backdrop data-testid="backdrop" />
        <Drawer.Viewport data-testid="viewport">
          <Drawer.Popup data-testid="popup" initialFocus={false} />
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  ),
  menu: (record: Recorder) => (
    <Menu.Root defaultOpen onOpenChange={record}>
      <Menu.Trigger>Child trigger</Menu.Trigger>
      <Menu.Portal>
        <Menu.Backdrop data-testid="backdrop" />
        <Menu.Positioner data-testid="positioner">
          <Menu.Popup data-testid="popup">
            <Menu.Item>Item</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  ),
  select: (record: Recorder) => (
    <Select.Root defaultOpen onOpenChange={record}>
      <Select.Trigger>
        <Select.Value placeholder="Pick" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Backdrop data-testid="backdrop" />
        <Select.Positioner data-testid="positioner" alignItemWithTrigger={false}>
          <Select.Popup data-testid="popup">
            <Select.Item value="a">A</Select.Item>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  ),
  combobox: (record: Recorder) => (
    <Combobox.Root defaultOpen onOpenChange={record}>
      <Combobox.Input />
      <Combobox.Portal>
        <Combobox.Backdrop data-testid="backdrop" />
        <Combobox.Positioner data-testid="positioner">
          <Combobox.Popup data-testid="popup">
            <Combobox.List>
              <Combobox.Item value="a">A</Combobox.Item>
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  ),
  previewCard: (record: Recorder) => (
    <PreviewCard.Root defaultOpen onOpenChange={record}>
      <PreviewCard.Trigger href="#preview">Child trigger</PreviewCard.Trigger>
      <PreviewCard.Portal>
        <PreviewCard.Positioner data-testid="positioner">
          <PreviewCard.Popup data-testid="popup">Card</PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  ),
  tooltip: (record: Recorder) => (
    <Tooltip.Root defaultOpen onOpenChange={record}>
      <Tooltip.Trigger>Child trigger</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner data-testid="positioner">
          <Tooltip.Popup data-testid="popup">Tip</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  ),
  // The list calls `useDismissLayer`, and the portal is not below the list.
  navigationMenu: (record: Recorder) => (
    <NavigationMenu.Root
      defaultValue="item"
      onValueChange={(value: unknown, details: { reason: string }) =>
        record(value !== null, details)
      }
    >
      <NavigationMenu.List>
        <NavigationMenu.Item value="item">
          <NavigationMenu.Trigger>Child trigger</NavigationMenu.Trigger>
          <NavigationMenu.Content>Content</NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>
      <NavigationMenu.Portal>
        <NavigationMenu.Backdrop data-testid="backdrop" />
        <NavigationMenu.Positioner data-testid="positioner">
          <NavigationMenu.Popup data-testid="popup">
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  ),
};

const INTERNAL_BACKDROP = 'internal backdrop';

function findPart(part: string) {
  if (part !== INTERNAL_BACKDROP) {
    return screen.getByTestId(part);
  }
  const portal = screen.getByTestId('popup').closest('[data-vase-ui-portal]');
  const backdrop = portal?.querySelector(':scope > [role="presentation"]:not([data-testid])');
  if (!backdrop) {
    throw new Error('The portal has no internal backdrop.');
  }
  return backdrop;
}

interface PressCase {
  name: string;
  parent: keyof typeof parents;
  child: keyof typeof children;
  /** The test id of the part, or `INTERNAL_BACKDROP`. */
  part: string;
  /** Whether a press on the part is an outside press of the child. */
  closesChild: boolean;
}

const OUTSIDE_PRESS: Change[] = [[false, 'outside-press']];

describe('a press on a part of a child popup that is outside its popup element', () => {
  const { render } = createRenderer();

  it.each<PressCase>([
    {
      name: 'Dialog.Backdrop / popover',
      parent: 'popover',
      child: 'dialog',
      part: 'backdrop',
      closesChild: true,
    },
    {
      name: 'Dialog.Viewport / popover',
      parent: 'popover',
      child: 'dialog',
      part: 'viewport',
      closesChild: true,
    },
    {
      name: 'Dialog internal backdrop / popover',
      parent: 'popover',
      child: 'dialog',
      part: INTERNAL_BACKDROP,
      closesChild: true,
    },
    {
      name: 'AlertDialog.Backdrop / popover',
      parent: 'popover',
      child: 'alertDialog',
      part: 'backdrop',
      closesChild: false,
    },
    {
      name: 'Drawer.Backdrop / popover',
      parent: 'popover',
      child: 'drawer',
      part: 'backdrop',
      closesChild: true,
    },
    {
      name: 'Drawer.Viewport / popover',
      parent: 'popover',
      child: 'drawer',
      part: 'viewport',
      closesChild: true,
    },
    {
      name: 'Menu.Positioner / popover',
      parent: 'popover',
      child: 'menu',
      part: 'positioner',
      closesChild: false,
    },
    {
      name: 'Select.Positioner / popover',
      parent: 'popover',
      child: 'select',
      part: 'positioner',
      closesChild: false,
    },
    {
      name: 'Combobox.Positioner / popover',
      parent: 'popover',
      child: 'combobox',
      part: 'positioner',
      closesChild: false,
    },
    {
      name: 'Menu.Backdrop / trap-focus',
      parent: 'trapFocusPopover',
      child: 'menu',
      part: 'backdrop',
      closesChild: true,
    },
    {
      name: 'Menu internal backdrop / trap-focus',
      parent: 'trapFocusPopover',
      child: 'menu',
      part: INTERNAL_BACKDROP,
      closesChild: true,
    },
    {
      name: 'Select.Backdrop / trap-focus',
      parent: 'trapFocusPopover',
      child: 'select',
      part: 'backdrop',
      closesChild: true,
    },
    {
      name: 'Combobox.Backdrop / trap-focus',
      parent: 'trapFocusPopover',
      child: 'combobox',
      part: 'backdrop',
      closesChild: true,
    },
    {
      name: 'PreviewCard.Positioner / dialog',
      parent: 'dialog',
      child: 'previewCard',
      part: 'positioner',
      closesChild: false,
    },
    {
      name: 'Tooltip.Positioner / dialog',
      parent: 'dialog',
      child: 'tooltip',
      part: 'positioner',
      closesChild: false,
    },
    {
      name: 'NavigationMenu.Backdrop / dialog',
      parent: 'dialog',
      child: 'navigationMenu',
      part: 'backdrop',
      closesChild: true,
    },
    {
      name: 'NavigationMenu.Popup / dialog',
      parent: 'dialog',
      child: 'navigationMenu',
      part: 'popup',
      closesChild: false,
    },
    // The case of a Popover above a Dialog comes back with the Dialog unit, when Dialog moves to
    // the stack of the popup layer.
  ])('VUE-4: $name closes no popup above', async ({ parent, child, part, closesChild }) => {
    const parentChanges: Change[] = [];
    const childChanges: Change[] = [];
    await render(
      parents[parent](recordInto(parentChanges), children[child](recordInto(childChanges))),
    );
    await screen.findByTestId('popup');

    await press(findPart(part));
    await flushMicrotasks();

    expect({ parent: parentChanges, child: childChanges }).toEqual({
      parent: [],
      child: closesChild ? OUTSIDE_PRESS : [],
    });
  });

  // A real click has the order of events and the targets of the browser.
  it.each([
    { name: 'a modal dialog', modal: true },
    { name: 'a dialog that is not modal', modal: false },
  ])(
    'VUE-4: a real click on the backdrop of $name in a popover closes only the dialog',
    async ({ modal }) => {
      const parentChanges: Change[] = [];
      const childChanges: Change[] = [];
      await render(
        parents.popover(
          recordInto(parentChanges),
          <Dialog.Root defaultOpen modal={modal} onOpenChange={recordInto(childChanges)}>
            <Dialog.Portal>
              <Dialog.Backdrop data-testid="backdrop" style={{ position: 'fixed', inset: 0 }} />
              <Dialog.Popup
                data-testid="popup"
                initialFocus={false}
                style={{ position: 'fixed', left: '40%', top: '40%' }}
              >
                Dialog
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>,
        ),
      );
      await screen.findByTestId('popup');

      // A modal dialog makes its own backdrop inert, so its internal backdrop gets the click.
      const backdrop = modal ? findPart(INTERNAL_BACKDROP) : screen.getByTestId('backdrop');
      await userEvent.click(backdrop, { position: { x: 5, y: 5 } });
      await flushMicrotasks();

      expect({ parent: parentChanges, child: childChanges }).toEqual({
        parent: [],
        child: OUTSIDE_PRESS,
      });
    },
  );
});

const Pending = defineAsyncComponent(() => new Promise<DefineComponent>(() => {}));

interface PendingPositionerCase {
  name: string;
  render: (record: Recorder, onOpenChangeComplete: (open: boolean) => void) => VNode;
}

describe('a press on the backdrop of a popup whose positioner has not mounted', () => {
  const { render } = createRenderer();

  it.each<PendingPositionerCase>([
    {
      name: 'Menu',
      render: (record, onOpenChangeComplete) => (
        <Menu.Root defaultOpen onOpenChange={record} onOpenChangeComplete={onOpenChangeComplete}>
          <Menu.Trigger>Trigger</Menu.Trigger>
          <Menu.Portal>
            <Menu.Backdrop data-testid="backdrop" />
            <Pending>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Item</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Pending>
          </Menu.Portal>
        </Menu.Root>
      ),
    },
    {
      name: 'Select',
      render: (record, onOpenChangeComplete) => (
        <Select.Root defaultOpen onOpenChange={record} onOpenChangeComplete={onOpenChangeComplete}>
          <Select.Trigger>
            <Select.Value placeholder="Pick" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Backdrop data-testid="backdrop" />
            <Pending>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="a">A</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Pending>
          </Select.Portal>
        </Select.Root>
      ),
    },
    {
      name: 'Combobox',
      render: (record, onOpenChangeComplete) => (
        <Combobox.Root
          defaultOpen
          onOpenChange={record}
          onOpenChangeComplete={onOpenChangeComplete}
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Backdrop data-testid="backdrop" />
            <Pending>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="a">A</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Pending>
          </Combobox.Portal>
        </Combobox.Root>
      ),
    },
    {
      name: 'Dialog',
      render: (record, onOpenChangeComplete) => (
        <Dialog.Root defaultOpen onOpenChange={record} onOpenChangeComplete={onOpenChangeComplete}>
          <Dialog.Portal>
            <Dialog.Backdrop data-testid="backdrop" />
            <Pending>
              <Dialog.Popup>Dialog</Dialog.Popup>
            </Pending>
          </Dialog.Portal>
        </Dialog.Root>
      ),
    },
    {
      name: 'Drawer',
      render: (record, onOpenChangeComplete) => (
        <Drawer.Root defaultOpen onOpenChange={record} onOpenChangeComplete={onOpenChangeComplete}>
          <Drawer.Portal>
            <Drawer.Backdrop data-testid="backdrop" />
            <Pending>
              <Drawer.Popup>Drawer</Drawer.Popup>
            </Pending>
          </Drawer.Portal>
        </Drawer.Root>
      ),
    },
  ])('closes $name and hides the backdrop', async ({ render: renderPopup }) => {
    const changes: Change[] = [];
    const onOpenChangeComplete = vi.fn();
    await render(renderPopup(recordInto(changes), onOpenChangeComplete));
    const backdrop = screen.getByTestId('backdrop');

    await press(backdrop);

    expect(changes).toEqual(OUTSIDE_PRESS);
    await waitFor(() => {
      expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
    });
    expect(backdrop.isConnected && !backdrop.hidden).toBe(false);
  });
});

describe('a press on the internal backdrop of a modal dialog whose popup has not mounted', () => {
  const { render } = createRenderer();

  it.each<{ name: string; render: (record: Recorder) => VNode }>([
    {
      name: 'Dialog',
      render: (record) => (
        <Dialog.Root defaultOpen onOpenChange={record}>
          <Dialog.Portal>
            <Pending>
              <Dialog.Popup>Dialog</Dialog.Popup>
            </Pending>
          </Dialog.Portal>
        </Dialog.Root>
      ),
    },
    {
      name: 'Drawer',
      render: (record) => (
        <Drawer.Root defaultOpen onOpenChange={record}>
          <Drawer.Portal>
            <Pending>
              <Drawer.Popup>Drawer</Drawer.Popup>
            </Pending>
          </Drawer.Portal>
        </Drawer.Root>
      ),
    },
  ])('closes $name and makes the internal backdrop inert', async ({ render: renderPopup }) => {
    const changes: Change[] = [];
    await render(renderPopup(recordInto(changes)));
    const backdrop = screen.getByRole('presentation', { hidden: true });

    await press(backdrop);

    expect(changes).toEqual(OUTSIDE_PRESS);
    expect(backdrop.inert).toBe(true);
  });
});
