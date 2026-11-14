import ComboboxArrow from './arrow/ComboboxArrow.vue';
import type { ComboboxArrowProps, ComboboxArrowState } from './arrow/ComboboxArrow.vue';
import ComboboxBackdrop from './backdrop/ComboboxBackdrop.vue';
import type { ComboboxBackdropProps, ComboboxBackdropState } from './backdrop/ComboboxBackdrop.vue';
import ComboboxClear from './clear/ComboboxClear.vue';
import type { ComboboxClearProps, ComboboxClearState } from './clear/ComboboxClear.vue';
import ComboboxIcon from './icon/ComboboxIcon.vue';
import type { ComboboxIconProps, ComboboxIconState } from './icon/ComboboxIcon.vue';
import ComboboxInput from './input/ComboboxInput.vue';
import type { ComboboxInputProps, ComboboxInputState } from './input/ComboboxInput.vue';
import ComboboxInputGroup from './input-group/ComboboxInputGroup.vue';
import type {
  ComboboxInputGroupProps,
  ComboboxInputGroupState,
} from './input-group/ComboboxInputGroup.vue';
import ComboboxPopup from './popup/ComboboxPopup.vue';
import type { ComboboxPopupProps, ComboboxPopupState } from './popup/ComboboxPopup.vue';
import ComboboxPortal from './portal/ComboboxPortal.vue';
import type { ComboboxPortalProps, ComboboxPortalState } from './portal/ComboboxPortal.vue';
import ComboboxPositioner from './positioner/ComboboxPositioner.vue';
import type {
  ComboboxPositionerProps,
  ComboboxPositionerState,
} from './positioner/ComboboxPositioner.vue';
import ComboboxRoot from './root/ComboboxRoot.vue';
import type {
  ComboboxRootActions,
  ComboboxRootChangeEventDetails,
  ComboboxRootChangeEventReason,
  ComboboxRootHighlightEventDetails,
  ComboboxRootHighlightEventReason,
  ComboboxRootOpenChangeEventDetails,
  ComboboxRootProps,
  ComboboxRootState,
} from './root/ComboboxRoot.vue';

/**
 * Groups all parts of the combobox.
 * Doesn't render its own HTML element.
 *
 * The part has more than one root node: the content of its default slot, then its hidden inputs.
 * `v-show` thus has no effect on it. Use `v-if`.
 */
export const Root: typeof ComboboxRoot = ComboboxRoot;
export namespace Root {
  export type Props<
    Value,
    Multiple extends boolean | undefined = false,
    Item = Value,
  > = ComboboxRootProps<Value, Multiple, Item>;
  export type State = ComboboxRootState;
  export type Actions = ComboboxRootActions;
  export type ChangeEventReason = ComboboxRootChangeEventReason;
  export type ChangeEventDetails = ComboboxRootChangeEventDetails;
  export type OpenChangeEventDetails = ComboboxRootOpenChangeEventDetails;
  export type HighlightEventReason = ComboboxRootHighlightEventReason;
  export type HighlightEventDetails = ComboboxRootHighlightEventDetails;
}

/**
 * A text input to search for items in the list.
 * Renders an `<input>` element.
 *
 * The part has more than one root node: the dismiss button of an open popup, then its element. A
 * rule of `<style scoped>` thus does not match its element, and `v-show` has no effect on it. Use
 * `:deep()`, a CSS module, a `style` binding or `v-if`.
 */
export const Input: typeof ComboboxInput = ComboboxInput;
export namespace Input {
  export type Props = ComboboxInputProps;
  export type State = ComboboxInputState;
}

/**
 * A wrapper for the input and its associated controls.
 * Renders a `<div>` element.
 */
export const InputGroup: typeof ComboboxInputGroup = ComboboxInputGroup;
export namespace InputGroup {
  export type Props = ComboboxInputGroupProps;
  export type State = ComboboxInputGroupState;
}

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 */
export const Portal: typeof ComboboxPortal = ComboboxPortal;
export namespace Portal {
  export type Props = ComboboxPortalProps;
  export type State = ComboboxPortalState;
}

/**
 * An overlay displayed beneath the popup.
 * Renders a `<div>` element.
 */
export const Backdrop: typeof ComboboxBackdrop = ComboboxBackdrop;
export namespace Backdrop {
  export type Props = ComboboxBackdropProps;
  export type State = ComboboxBackdropState;
}

/**
 * Positions the popup against the trigger.
 * Renders a `<div>` element.
 *
 * The part has more than one root node: the internal backdrop of a modal popup, then its element.
 * A rule of `<style scoped>` thus does not match its element, and `v-show` has no effect on it. Use
 * `:deep()`, a CSS module, a `style` binding or `v-if`.
 */
export const Positioner: typeof ComboboxPositioner = ComboboxPositioner;
export namespace Positioner {
  export type Props = ComboboxPositionerProps;
  export type State = ComboboxPositionerState;
}

/**
 * A container for the list.
 * Renders a `<div>` element.
 *
 * The part has more than one root node: the focus guards, its element, then a dismiss button. A
 * rule of `<style scoped>` thus does not match its element, and `v-show` has no effect on it. Use
 * `:deep()`, a CSS module, a `style` binding or `v-if`.
 */
export const Popup: typeof ComboboxPopup = ComboboxPopup;
export namespace Popup {
  export type Props = ComboboxPopupProps;
  export type State = ComboboxPopupState;
}

/**
 * Displays an element positioned against the anchor.
 * Renders a `<div>` element.
 */
export const Arrow: typeof ComboboxArrow = ComboboxArrow;
export namespace Arrow {
  export type Props = ComboboxArrowProps;
  export type State = ComboboxArrowState;
}

/**
 * An icon that indicates that the trigger button opens the popup.
 * Renders a `<span>` element.
 */
export const Icon: typeof ComboboxIcon = ComboboxIcon;
export namespace Icon {
  export type Props = ComboboxIconProps;
  export type State = ComboboxIconState;
}

/**
 * Clears the value when clicked.
 * Renders a `<button>` element.
 */
export const Clear: typeof ComboboxClear = ComboboxClear;
export namespace Clear {
  export type Props = ComboboxClearProps;
  export type State = ComboboxClearState;
}

export { useComboboxFilter as useFilter } from './root/utils/useFilter';
export { useFilteredItems } from './root/utils/useFilteredItems';
export { createComboboxItems as createItems } from './items/createItems';
