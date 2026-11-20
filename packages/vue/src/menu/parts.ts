import MenuRoot from './MenuRoot.vue';
import MenuTrigger from './MenuTrigger.vue';
import MenuPortal from './MenuPortal.vue';
import MenuBackdrop from './MenuBackdrop.vue';
import MenuPositioner from './MenuPositioner.vue';
import MenuPopup from './MenuPopup.vue';
import MenuArrow from './MenuArrow.vue';
import MenuViewport from './MenuViewport.vue';
import MenuItem from './MenuItem.vue';
import MenuLinkItem from './MenuLinkItem.vue';
import MenuCheckboxItem from './MenuCheckboxItem.vue';
import MenuRadioGroup from './MenuRadioGroup.vue';
import MenuRadioItem from './MenuRadioItem.vue';
import MenuSubmenuRoot from './MenuSubmenuRoot.vue';
import MenuSubmenuTrigger from './MenuSubmenuTrigger.vue';
import MenuGroup from './MenuGroup.vue';
import MenuGroupLabel from './MenuGroupLabel.vue';
import MenuList from './MenuList.vue';
import MenuFilterProvider from './MenuFilterProvider.vue';
import MenuInput from './MenuInput.vue';
import MenuClear from './MenuClear.vue';
import MenuEmpty from './MenuEmpty.vue';
import SeparatorPart from '../separator/Separator.vue';
import type {
  MenuArrowProps,
  MenuArrowState,
  MenuBackdropProps,
  MenuBackdropState,
  MenuCheckboxItemChangeEventDetails,
  MenuCheckboxItemChangeEventReason,
  MenuCheckboxItemProps,
  MenuCheckboxItemState,
  MenuClearProps,
  MenuClearState,
  MenuEmptyProps,
  MenuEmptyState,
  MenuFilterProviderChangeEventDetails,
  MenuFilterProviderChangeEventReason,
  MenuFilterProviderProps,
  MenuFilterProviderState,
  MenuGroupLabelProps,
  MenuGroupLabelState,
  MenuGroupProps,
  MenuGroupState,
  MenuInputProps,
  MenuInputState,
  MenuItemProps,
  MenuItemState,
  MenuLinkItemProps,
  MenuLinkItemState,
  MenuListProps,
  MenuListState,
  MenuPopupProps,
  MenuPopupState,
  MenuPortalProps,
  MenuPortalState,
  MenuPositionerProps,
  MenuPositionerState,
  MenuRadioGroupChangeEventDetails,
  MenuRadioGroupChangeEventReason,
  MenuRadioGroupProps,
  MenuRadioGroupState,
  MenuRadioItemProps,
  MenuRadioItemState,
  MenuRootChangeEventDetails,
  MenuRootChangeEventReason,
  MenuRootHighlightEventDetails,
  MenuRootHighlightEventReason,
  MenuRootOrientation,
  MenuRootProps,
  MenuRootState,
  MenuSeparatorProps,
  MenuSeparatorState,
  MenuSubmenuRootChangeEventDetails,
  MenuSubmenuRootChangeEventReason,
  MenuSubmenuRootProps,
  MenuSubmenuRootState,
  MenuSubmenuTriggerProps,
  MenuSubmenuTriggerState,
  MenuTriggerProps,
  MenuTriggerState,
  MenuViewportProps,
  MenuViewportState,
} from './types';

export { createHandle, MenuHandle as Handle } from './root';
export { getFilter as useFilter } from '../internals/filter';

/**
 * Groups the parts of the menu.
 * Renders no element.
 */
export const Root: typeof MenuRoot = MenuRoot;
export namespace Root {
  export type Props<Payload = unknown> = MenuRootProps<Payload>;
  export type State = MenuRootState;
  export type ChangeEventReason = MenuRootChangeEventReason;
  export type ChangeEventDetails = MenuRootChangeEventDetails;
  export type HighlightEventReason = MenuRootHighlightEventReason;
  export type HighlightEventDetails = MenuRootHighlightEventDetails;
  export type Orientation = MenuRootOrientation;
}

/**
 * A button that opens the menu.
 * Renders a `<button>` element.
 * @selector `[aria-expanded="true"]` The menu is open for this trigger.
 * @selector `[data-pressed]` A press of the trigger opened the menu, and the menu is open.
 * @selector `:disabled` The trigger is a native button, and the trigger, the menu or a fieldset around it is disabled.
 * @selector `[aria-disabled="true"]` The trigger is another element, and the trigger or the menu is disabled.
 */
export const Trigger: typeof MenuTrigger = MenuTrigger;
export namespace Trigger {
  export type Props<Payload = unknown> = MenuTriggerProps<Payload>;
  export type State = MenuTriggerState;
}

/**
 * Moves its content to another place of the DOM, `<body>` by default.
 * Renders no element.
 */
export const Portal: typeof MenuPortal = MenuPortal;
export namespace Portal {
  export type Props = MenuPortalProps;
  export type State = MenuPortalState;
}

/**
 * An overlay under the menu.
 * Renders a `<div>` element.
 * @selector `[hidden]` The menu is closed, and `keepMounted` of the portal keeps the backdrop in the DOM.
 */
export const Backdrop: typeof MenuBackdrop = MenuBackdrop;
export namespace Backdrop {
  export type Props = MenuBackdropProps;
  export type State = MenuBackdropState;
}

/**
 * Places the popup at its anchor.
 * Renders a `<div>` element.
 * @selector `[data-side]` The side of the anchor that the popup is on: `top`, `bottom`, `left`, `right`, `inline-start` or `inline-end`. A logical side shows only when the `side` prop is logical.
 * @selector `[data-align]` The alignment of the popup on its side: `start`, `center` or `end`.
 * @selector `[data-anchor-hidden]` The anchor is out of view.
 * @cssVariable `--anchor-width` The width of the anchor, in pixels.
 * @cssVariable `--anchor-height` The height of the anchor, in pixels.
 * @cssVariable `--available-width` The width from the anchor to the edge of the collision boundary, in pixels.
 * @cssVariable `--available-height` The height from the anchor to the edge of the collision boundary, in pixels.
 * @cssVariable `--transform-origin` The point that the popup grows from.
 * @cssVariable `--positioner-width` The width of the popup, and at a move to another trigger the width of the new content, in pixels. Only a menu with `Menu.Viewport` has it.
 * @cssVariable `--positioner-height` The height of the popup, and at a move to another trigger the height of the new content, in pixels. Only a menu with `Menu.Viewport` has it.
 */
export const Positioner: typeof MenuPositioner = MenuPositioner;
export namespace Positioner {
  export type Props = MenuPositionerProps;
  export type State = MenuPositionerState;
}

/**
 * The container of the items of the menu.
 * Renders a `<div>` element.
 * @selector `[data-side]` The side of the anchor that the popup is on, as on the positioner.
 * @selector `[data-align]` The alignment of the popup on its side: `start`, `center` or `end`.
 * @selector `[data-instant]` An animation should not run: `click` after a key on the trigger, `dismiss` after Escape, `group` at a move between the menus of a menubar, or `trigger-change` after a move to another trigger.
 * @selector `[hidden]` The menu is closed, and `keepMounted` of the portal keeps the popup in the DOM.
 * @cssVariable `--popup-width` The width of the popup, in pixels: the old width, then the new width, while `Menu.Viewport` moves to another trigger.
 * @cssVariable `--popup-height` The height of the popup, in pixels: the old height, then the new height, while `Menu.Viewport` moves to another trigger.
 */
export const Popup: typeof MenuPopup = MenuPopup;
export namespace Popup {
  export type Props = MenuPopupProps;
  export type State = MenuPopupState;
}

/**
 * An element that points to the anchor.
 * Renders a `<div>` element.
 * @selector `[data-side]` The side of the anchor that the popup is on, as on the positioner.
 * @selector `[data-align]` The alignment of the popup on its side: `start`, `center` or `end`.
 * @selector `[data-uncentered]` The arrow cannot point to the center of the anchor.
 */
export const Arrow: typeof MenuArrow = MenuArrow;
export namespace Arrow {
  export type Props = MenuArrowProps;
  export type State = MenuArrowState;
}

/**
 * The container of content that changes when the menu moves to another trigger.
 * Renders a `<div>` element.
 * @selector `[data-activation-direction]` The side of the new trigger from the old one: `left` or `right`, `up` or `down`, or one of each, such as `right down`.
 * @selector `[data-instant]` An animation should not run, with the values of the popup.
 */
export const Viewport: typeof MenuViewport = MenuViewport;
export namespace Viewport {
  export type Props = MenuViewportProps;
  export type State = MenuViewportState;
}

/**
 * An item of the menu.
 * Renders a `<div>` element.
 * @selector `[data-highlighted]` The item has the highlight.
 * @selector `[aria-disabled="true"]` The item or the menu is disabled.
 * @selector `[hidden]` The item does not match the query of the filter.
 */
export const Item: typeof MenuItem = MenuItem;
export namespace Item {
  export type Props = MenuItemProps;
  export type State = MenuItemState;
}

/**
 * A link in the menu.
 * Renders an `<a>` element.
 * @selector `[data-highlighted]` The link has the highlight.
 * @selector `[hidden]` The link does not match the query of the filter.
 */
export const LinkItem: typeof MenuLinkItem = MenuLinkItem;
export namespace LinkItem {
  export type Props = MenuLinkItemProps;
  export type State = MenuLinkItemState;
}

/**
 * An item that the user checks and unchecks.
 * Renders a `<div>` element.
 * @selector `[aria-checked="true"]` The item is checked.
 * @selector `[data-highlighted]` The item has the highlight.
 * @selector `[aria-disabled="true"]` The item or the menu is disabled.
 * @selector `[hidden]` The item does not match the query of the filter.
 */
export const CheckboxItem: typeof MenuCheckboxItem = MenuCheckboxItem;
export namespace CheckboxItem {
  export type Props = MenuCheckboxItemProps;
  export type State = MenuCheckboxItemState;
  export type ChangeEventReason = MenuCheckboxItemChangeEventReason;
  export type ChangeEventDetails = MenuCheckboxItemChangeEventDetails;
}

/**
 * Groups radio items, of which one is checked.
 * Renders a `<div>` element.
 * @selector `[aria-disabled="true"]` The group is disabled.
 * @selector `[hidden]` No item of the group matches the query of the filter.
 */
export const RadioGroup: typeof MenuRadioGroup = MenuRadioGroup;
export namespace RadioGroup {
  export type Props<Value = unknown> = MenuRadioGroupProps<Value>;
  export type State = MenuRadioGroupState;
  export type ChangeEventReason = MenuRadioGroupChangeEventReason;
  export type ChangeEventDetails = MenuRadioGroupChangeEventDetails;
}

/**
 * An item of a radio group.
 * Renders a `<div>` element.
 * @selector `[aria-checked="true"]` The item is checked.
 * @selector `[data-highlighted]` The item has the highlight.
 * @selector `[aria-disabled="true"]` The item, its group or the menu is disabled.
 * @selector `[hidden]` The item does not match the query of the filter.
 */
export const RadioItem: typeof MenuRadioItem = MenuRadioItem;
export namespace RadioItem {
  export type Props<Value = unknown> = MenuRadioItemProps<Value>;
  export type State = MenuRadioItemState;
}

/**
 * Groups the parts of a submenu.
 * Renders no element.
 */
export const SubmenuRoot: typeof MenuSubmenuRoot = MenuSubmenuRoot;
export namespace SubmenuRoot {
  export type Props = MenuSubmenuRootProps;
  export type State = MenuSubmenuRootState;
  export type ChangeEventReason = MenuSubmenuRootChangeEventReason;
  export type ChangeEventDetails = MenuSubmenuRootChangeEventDetails;
}

/**
 * An item that opens a submenu.
 * Renders a `<div>` element.
 * @selector `[data-popup-open]` The submenu is open.
 * @selector `[data-highlighted]` The item has the highlight.
 * @selector `[aria-disabled="true"]` The item, the submenu or the parent menu is disabled.
 * @selector `[hidden]` The item does not match the query of the filter.
 */
export const SubmenuTrigger: typeof MenuSubmenuTrigger = MenuSubmenuTrigger;
export namespace SubmenuTrigger {
  export type Props = MenuSubmenuTriggerProps;
  export type State = MenuSubmenuTriggerState;
}

/**
 * Groups related items.
 * Renders a `<div>` element.
 * @selector `[hidden]` No item of the group matches the query of the filter.
 */
export const Group: typeof MenuGroup = MenuGroup;
export namespace Group {
  export type Props = MenuGroupProps;
  export type State = MenuGroupState;
}

/**
 * A label that names its group.
 * Renders a `<div>` element.
 */
export const GroupLabel: typeof MenuGroupLabel = MenuGroupLabel;
export namespace GroupLabel {
  export type Props = MenuGroupLabelProps;
  export type State = MenuGroupLabelState;
}

/**
 * A separator element accessible to screen readers.
 * Renders a `<div>` element.
 * @selector `[aria-orientation]` The orientation of the separator: `horizontal` or `vertical`.
 */
export const Separator: typeof SeparatorPart = SeparatorPart;
export namespace Separator {
  export type Props = MenuSeparatorProps;
  export type State = MenuSeparatorState;
}

/**
 * The container of the items in a popup that has other content.
 * Renders a `<div>` element.
 */
export const List: typeof MenuList = MenuList;
export namespace List {
  export type Props = MenuListProps;
  export type State = MenuListState;
}

/**
 * Makes the root in it filter its items with a query.
 * Renders no element.
 */
export const FilterProvider: typeof MenuFilterProvider = MenuFilterProvider;
export namespace FilterProvider {
  export type Props = MenuFilterProviderProps;
  export type State = MenuFilterProviderState;
  export type ChangeEventReason = MenuFilterProviderChangeEventReason;
  export type ChangeEventDetails = MenuFilterProviderChangeEventDetails;
}

/**
 * A text input for the query of the filter.
 * Renders an `<input>` element.
 * @selector `[data-highlighted]` The input shows its focus ring: a key gave it the focus, and no key moved the highlight to an item.
 * @selector `:disabled` The input is disabled.
 */
export const Input: typeof MenuInput = MenuInput;
export namespace Input {
  export type Props = MenuInputProps;
  export type State = MenuInputState;
}

/**
 * A button that empties the query.
 * Renders a `<button>` element.
 * @selector `:disabled` The button is a native button, and it is disabled.
 * @selector `[aria-disabled="true"]` The button is another element, and it is disabled.
 */
export const Clear: typeof MenuClear = MenuClear;
export namespace Clear {
  export type Props = MenuClearProps;
  export type State = MenuClearState;
}

/**
 * A message while the query shows no item.
 * Renders a `<div>` element.
 */
export const Empty: typeof MenuEmpty = MenuEmpty;
export namespace Empty {
  export type Props = MenuEmptyProps;
  export type State = MenuEmptyState;
}
