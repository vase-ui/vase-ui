import SelectRoot from './SelectRoot.vue';
import SelectLabel from './SelectLabel.vue';
import SelectTrigger from './SelectTrigger.vue';
import SelectValue from './SelectValue.vue';
import SelectIcon from './SelectIcon.vue';
import SelectPortal from './SelectPortal.vue';
import SelectBackdrop from './SelectBackdrop.vue';
import SelectPositioner from './SelectPositioner.vue';
import SelectPopup from './SelectPopup.vue';
import SelectArrow from './SelectArrow.vue';
import SelectList from './SelectList.vue';
import SelectItem from './SelectItem.vue';
import SelectItemText from './SelectItemText.vue';
import SelectGroup from './SelectGroup.vue';
import SelectGroupLabel from './SelectGroupLabel.vue';
import SelectSeparator from './SelectSeparator.vue';
import SelectScrollUpArrow from './SelectScrollUpArrow.vue';
import SelectScrollDownArrow from './SelectScrollDownArrow.vue';
import type {
  SelectArrowProps,
  SelectArrowState,
  SelectBackdropProps,
  SelectBackdropState,
  SelectGroupLabelProps,
  SelectGroupLabelState,
  SelectGroupProps,
  SelectGroupState,
  SelectIconProps,
  SelectIconState,
  SelectItemProps,
  SelectItemState,
  SelectItemTextProps,
  SelectItemTextState,
  SelectLabelProps,
  SelectLabelState,
  SelectListProps,
  SelectListState,
  SelectPopupProps,
  SelectPopupState,
  SelectPortalProps,
  SelectPortalState,
  SelectPositionerProps,
  SelectPositionerState,
  SelectRootChangeEventDetails,
  SelectRootChangeEventReason,
  SelectRootEmits,
  SelectRootOpenChangeEventDetails,
  SelectRootOpenChangeEventReason,
  SelectRootProps,
  SelectRootState,
  SelectScrollDownArrowProps,
  SelectScrollDownArrowState,
  SelectScrollUpArrowProps,
  SelectScrollUpArrowState,
  SelectSeparatorProps,
  SelectSeparatorState,
  SelectTriggerProps,
  SelectTriggerState,
  SelectValueProps,
  SelectValueState,
} from './types';

/**
 * Groups the parts of the select, and holds its value and its form inputs.
 * Renders a `<div>` element.
 * A `<p>` cannot hold the `<div>` of the root: the HTML parser closes the paragraph at the `<div>`,
 * and the hydration fails.
 */
export const Root: typeof SelectRoot = SelectRoot;
export namespace Root {
  export type Props<Value = any, Multiple extends boolean | undefined = false> = SelectRootProps<
    Value,
    Multiple
  >;
  export type Emits<Value = any, Multiple extends boolean | undefined = false> = SelectRootEmits<
    Value,
    Multiple
  >;
  export type State = SelectRootState;
  export type ChangeEventReason = SelectRootChangeEventReason;
  export type ChangeEventDetails = SelectRootChangeEventDetails;
  export type OpenChangeEventReason = SelectRootOpenChangeEventReason;
  export type OpenChangeEventDetails = SelectRootOpenChangeEventDetails;
}

/**
 * A label that names the select. A click gives the focus to the trigger.
 * Renders a `<div>` element.
 * @selector `[data-disabled]` The select is disabled.
 * @selector `[data-valid]` In a `Field.Root`, the value is valid.
 * @selector `[data-invalid]` In a `Field.Root`, the value is invalid.
 * @selector `[data-touched]` In a `Field.Root`, the focus left the control one time or more.
 * @selector `[data-dirty]` In a `Field.Root`, the value differs from the first value.
 * @selector `[data-filled]` In a `Field.Root`, the select has a value.
 */
export const Label: typeof SelectLabel = SelectLabel;
export namespace Label {
  export type Props = SelectLabelProps;
  export type State = SelectLabelState;
}

/**
 * A button that opens the popup.
 * Renders a `<button>` element.
 * Without `multiple` and `readonly`, a key on the closed trigger selects the next item whose text
 * starts with the typed text, as on a native `<select>`.
 * @selector `[aria-expanded="true"]` The popup is open.
 * @selector `[data-pressed]` The popup is open.
 * @selector `[data-popup-side]` The side of the trigger that the open popup is on, or `none` while the popup covers the trigger.
 * @selector `[data-placeholder]` The select has no value.
 * @selector `:disabled` The trigger is a native button, and the trigger, the select or a fieldset around it is disabled.
 * @selector `[aria-disabled="true"]` The trigger is another element, and the trigger or the select is disabled.
 * @selector `[aria-readonly="true"]` The select is read-only.
 * @selector `[aria-required="true"]` The select is required.
 * @selector `[aria-invalid="true"]` In a `Field.Root`, the value is invalid.
 * @selector `[data-valid]` In a `Field.Root`, the value is valid.
 * @selector `[data-touched]` In a `Field.Root`, the focus left the control one time or more.
 * @selector `[data-dirty]` In a `Field.Root`, the value differs from the first value.
 * @selector `[data-filled]` In a `Field.Root`, the select has a value.
 */
export const Trigger: typeof SelectTrigger = SelectTrigger;
export namespace Trigger {
  export type Props = SelectTriggerProps;
  export type State<Value = any> = SelectTriggerState<Value>;
}

/**
 * The text of the value, or the placeholder.
 * Renders a `<span>` element.
 * @selector `[data-placeholder]` The select has no value.
 */
export const Value: typeof SelectValue = SelectValue;
export namespace Value {
  export type Props = SelectValueProps;
  export type State<Value = any> = SelectValueState<Value>;
}

/**
 * An icon that shows the select opens a list.
 * Renders a `<span>` element.
 * @selector `[data-popup-open]` The popup is open.
 */
export const Icon: typeof SelectIcon = SelectIcon;
export namespace Icon {
  export type Props = SelectIconProps;
  export type State = SelectIconState;
}

/**
 * Moves its content to another place of the DOM, `<body>` by default.
 * Renders a visually hidden `<span>` in place while the moved popup is open. Its `aria-owns` names
 * the popup, so a screen reader reads the popup after its trigger.
 * From the first focus of the trigger, the first open or the first fill of the browser, it keeps
 * its content in the DOM, so the closed select has its items.
 */
export const Portal: typeof SelectPortal = SelectPortal;
export namespace Portal {
  export type Props = SelectPortalProps;
  export type State = SelectPortalState;
}

/**
 * An overlay under the popup.
 * Renders a `<div>` element.
 */
export const Backdrop: typeof SelectBackdrop = SelectBackdrop;
export namespace Backdrop {
  export type Props = SelectBackdropProps;
  export type State = SelectBackdropState;
}

/**
 * Places the popup at the trigger, or over it.
 * Renders a `<div>` element.
 * @selector `[data-side]` The side of the trigger that the popup is on: `top`, `bottom`, `left`, `right`, `inline-start` or `inline-end`. It is `none` while the popup covers the trigger.
 * @selector `[data-align]` The alignment of the popup on its side: `start`, `center` or `end`.
 * @selector `[data-anchor-hidden]` The anchor is out of view.
 * @cssVariable `--anchor-width` The width of the anchor, in pixels.
 * @cssVariable `--anchor-height` The height of the anchor, in pixels.
 * @cssVariable `--available-width` The width that the popup can fill before it overflows the boundary, in pixels.
 * @cssVariable `--available-height` The height that the popup can fill before it overflows the boundary, in pixels.
 * @cssVariable `--transform-origin` The point that the popup grows from, for the `transform-origin` of the popup. It is at the arrow, on the edge of the anchor. With no arrow, it is at the aligned edge of the popup or at the center of the anchor. A popup over the trigger grows from the middle of the value.
 */
export const Positioner: typeof SelectPositioner = SelectPositioner;
export namespace Positioner {
  export type Props = SelectPositionerProps;
  export type State = SelectPositionerState;
}

/**
 * The container of the items.
 * Renders a `<div>` element.
 * @selector `[data-side]` The side of the trigger that the popup is on, or `none` while the popup covers the trigger.
 * @selector `[data-align]` The alignment of the popup on its side: `start`, `center` or `end`.
 */
export const Popup: typeof SelectPopup = SelectPopup;
export namespace Popup {
  export type Props = SelectPopupProps;
  export type State = SelectPopupState;
}

/**
 * An element that points to the center of the trigger.
 * Renders a `<div>` element.
 * Its place is in the padding box of its nearest positioned ancestor: the popup when the popup has a `position`, else the positioner.
 * It renders nothing while the popup covers the trigger.
 * @selector `[data-side]` The side of the trigger that the popup is on.
 * @selector `[data-align]` The alignment of the popup on its side: `start`, `center` or `end`.
 * @selector `[data-uncentered]` The arrow cannot point to the center of the anchor.
 */
export const Arrow: typeof SelectArrow = SelectArrow;
export namespace Arrow {
  export type Props = SelectArrowProps;
  export type State = SelectArrowState;
}

/**
 * The element that holds the items and scrolls.
 * Renders a `<div>` element.
 */
export const List: typeof SelectList = SelectList;
export namespace List {
  export type Props = SelectListProps;
  export type State = SelectListState;
}

/**
 * An option that the user can select.
 * Renders a `<div>` element.
 * @selector `[data-highlighted]` The item has the highlight.
 * @selector `[aria-selected="true"]` The item is selected.
 * @selector `[aria-disabled="true"]` The item or the select is disabled.
 */
export const Item: typeof SelectItem = SelectItem;
export namespace Item {
  export type Props = SelectItemProps;
  export type State = SelectItemState;
}

/**
 * The text of an item, which the popup puts over the value.
 * Renders a `<div>` element.
 */
export const ItemText: typeof SelectItemText = SelectItemText;
export namespace ItemText {
  export type Props = SelectItemTextProps;
  export type State = SelectItemTextState;
}

/**
 * Groups related items.
 * Renders a `<div>` element.
 */
export const Group: typeof SelectGroup = SelectGroup;
export namespace Group {
  export type Props = SelectGroupProps;
  export type State = SelectGroupState;
}

/**
 * A label that names a group.
 * Renders a `<div>` element.
 */
export const GroupLabel: typeof SelectGroupLabel = SelectGroupLabel;
export namespace GroupLabel {
  export type Props = SelectGroupLabelProps;
  export type State = SelectGroupLabelState;
}

/**
 * Separates groups of items.
 * Renders a `<div>` element.
 * @selector `[data-orientation]` The orientation of the separator: `horizontal` or `vertical`.
 */
export const Separator: typeof SelectSeparator = SelectSeparator;
export namespace Separator {
  export type Props = SelectSeparatorProps;
  export type State = SelectSeparatorState;
}

/**
 * Scrolls the list up while the pointer moves on it.
 * Renders a `<div>` element.
 * @selector `[hidden]` The list cannot scroll up, and `keepMounted` keeps the arrow in the DOM.
 * @selector `[data-side]` The side of the trigger that the popup is on, or `none` while the popup covers the trigger.
 */
export const ScrollUpArrow: typeof SelectScrollUpArrow = SelectScrollUpArrow;
export namespace ScrollUpArrow {
  export type Props = SelectScrollUpArrowProps;
  export type State = SelectScrollUpArrowState;
}

/**
 * Scrolls the list down while the pointer moves on it.
 * Renders a `<div>` element.
 * @selector `[hidden]` The list cannot scroll down, and `keepMounted` keeps the arrow in the DOM.
 * @selector `[data-side]` The side of the trigger that the popup is on, or `none` while the popup covers the trigger.
 */
export const ScrollDownArrow: typeof SelectScrollDownArrow = SelectScrollDownArrow;
export namespace ScrollDownArrow {
  export type Props = SelectScrollDownArrowProps;
  export type State = SelectScrollDownArrowState;
}
