import { expectType } from '#test-utils';
import {
  Menu,
  type MenuCheckboxItemChangeEventDetails,
  type MenuRadioGroupChangeEventDetails,
  type MenuRootChangeEventDetails,
  type MenuRootChangeEventReason,
  type MenuRootHighlightEventDetails,
} from '@vase-ui/vue/menu';
import type { ContextMenu } from '@vase-ui/vue/context-menu';

// A handle carries the type of the payload of its root and its triggers.
const handle = Menu.createHandle<{ id: number }>();
expectType<Menu.Handle<{ id: number }>, typeof handle>(handle);
export const constructed: Menu.Handle<string> = new Menu.Handle<string>();
export const rootProps: Menu.Root.Props<{ id: number }> = { handle, modal: false };
export const triggerProps: Menu.Trigger.Props<{ id: number }> = { handle, payload: { id: 1 } };
// @ts-expect-error The payload of the trigger has the type of the handle.
export const wrongPayload: Menu.Trigger.Props<{ id: number }> = { handle, payload: 'one' };

// The details of a change name its reason, its trigger and the propagation of its event.
declare const details: MenuRootChangeEventDetails;
expectType<MenuRootChangeEventReason, typeof details.reason>(details.reason);
expectType<Element | undefined, typeof details.trigger>(details.trigger);
expectType<Menu.Root.ChangeEventDetails, typeof details>(details);
expectType<Menu.SubmenuRoot.ChangeEventDetails, typeof details>(details);

// A highlight has no event when no event of the user moved it.
declare const highlight: MenuRootHighlightEventDetails;
expectType<Event | undefined, typeof highlight.event>(highlight.event);
expectType<'keyboard' | 'pointer' | 'none', typeof highlight.reason>(highlight.reason);

// A checkbox item and a radio group send one reason.
declare const checked: MenuCheckboxItemChangeEventDetails;
expectType<'item-press', typeof checked.reason>(checked.reason);
declare const picked: MenuRadioGroupChangeEventDetails;
expectType<'item-press', typeof picked.reason>(picked.reason);

// The value of a radio group has its own type.
export const radioGroupProps: Menu.RadioGroup.Props<number> = { modelValue: 1, defaultValue: 2 };
// @ts-expect-error The value of the group is a number.
export const wrongValue: Menu.RadioGroup.Props<number> = { modelValue: 'one' };

// A link item takes the attributes of a link.
export const linkProps: Menu.LinkItem.Props = { href: '/settings', closeOnClick: true };

// The positioner takes the sides of Base UI, an offset function and a virtual anchor.
export const positionerProps: Menu.Positioner.Props = {
  side: 'inline-end',
  align: 'start',
  sideOffset: ({ anchor }) => anchor.height,
  anchor: { getBoundingClientRect: () => new DOMRect() },
};
// @ts-expect-error The positioner of a context menu has no `positionMethod`.
export const contextPositioner: ContextMenu.Positioner.Props = { positionMethod: 'fixed' };

// A template ref of a part has its element, and a template ref of a root has `close`.
const popup = null as unknown as InstanceType<typeof Menu.Popup>;
expectType<HTMLElement | null, typeof popup.element>(popup.element);
const submenuRoot = null as unknown as InstanceType<typeof Menu.SubmenuRoot>;
expectType<() => void, typeof submenuRoot.close>(submenuRoot.close);
