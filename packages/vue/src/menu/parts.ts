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
 */
export const Backdrop: typeof MenuBackdrop = MenuBackdrop;
export namespace Backdrop {
  export type Props = MenuBackdropProps;
  export type State = MenuBackdropState;
}

/**
 * Places the popup at its anchor.
 * Renders a `<div>` element.
 */
export const Positioner: typeof MenuPositioner = MenuPositioner;
export namespace Positioner {
  export type Props = MenuPositionerProps;
  export type State = MenuPositionerState;
}

/**
 * The container of the items of the menu.
 * Renders a `<div>` element.
 */
export const Popup: typeof MenuPopup = MenuPopup;
export namespace Popup {
  export type Props = MenuPopupProps;
  export type State = MenuPopupState;
}

/**
 * An element that points to the anchor.
 * Renders a `<div>` element.
 */
export const Arrow: typeof MenuArrow = MenuArrow;
export namespace Arrow {
  export type Props = MenuArrowProps;
  export type State = MenuArrowState;
}

/**
 * The container of content that changes when the menu moves to another trigger.
 * Renders a `<div>` element.
 */
export const Viewport: typeof MenuViewport = MenuViewport;
export namespace Viewport {
  export type Props = MenuViewportProps;
  export type State = MenuViewportState;
}

/**
 * An item of the menu.
 * Renders a `<div>` element.
 */
export const Item: typeof MenuItem = MenuItem;
export namespace Item {
  export type Props = MenuItemProps;
  export type State = MenuItemState;
}

/**
 * A link in the menu.
 * Renders an `<a>` element.
 */
export const LinkItem: typeof MenuLinkItem = MenuLinkItem;
export namespace LinkItem {
  export type Props = MenuLinkItemProps;
  export type State = MenuLinkItemState;
}

/**
 * An item that the user checks and unchecks.
 * Renders a `<div>` element.
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
 */
export const SubmenuTrigger: typeof MenuSubmenuTrigger = MenuSubmenuTrigger;
export namespace SubmenuTrigger {
  export type Props = MenuSubmenuTriggerProps;
  export type State = MenuSubmenuTriggerState;
}

/**
 * Groups related items.
 * Renders a `<div>` element.
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
 */
export const Input: typeof MenuInput = MenuInput;
export namespace Input {
  export type Props = MenuInputProps;
  export type State = MenuInputState;
}

/**
 * A button that empties the query.
 * Renders a `<button>` element.
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
