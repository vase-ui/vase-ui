import { describe, expect, it, vi } from 'vitest';
import { defineAsyncComponent } from 'vue';
import type { DefineComponent, VNode } from 'vue';
import { createRenderer, fireEvent, flushMicrotasks, screen, waitFor } from '#test-utils';
import * as Combobox from '../../../combobox/index.parts';
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
};

// Each child is open at the mount. The cases press the parts that have a test id.
const children = {
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
