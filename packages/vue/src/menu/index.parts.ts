import MenuArrow from './arrow/MenuArrow.vue';
import type { MenuArrowProps, MenuArrowState } from './arrow/MenuArrow.vue';
import MenuBackdrop from './backdrop/MenuBackdrop.vue';
import type { MenuBackdropProps, MenuBackdropState } from './backdrop/MenuBackdrop.vue';
import MenuPopup from './popup/MenuPopup.vue';
import type { MenuPopupProps, MenuPopupState } from './popup/MenuPopup.vue';
import MenuPortal from './portal/MenuPortal.vue';
import type { MenuPortalProps, MenuPortalState } from './portal/MenuPortal.vue';
import MenuPositioner from './positioner/MenuPositioner.vue';
import type { MenuPositionerProps, MenuPositionerState } from './positioner/MenuPositioner.vue';
import MenuRoot from './root/MenuRoot.vue';
import type {
  MenuRootActions,
  MenuRootChangeEventDetails,
  MenuRootChangeEventReason,
  MenuRootHighlightEventDetails,
  MenuRootHighlightEventReason,
  MenuRootOrientation,
  MenuRootProps,
  MenuRootState,
} from './root/MenuRoot.vue';
import MenuTrigger from './trigger/MenuTrigger.vue';
import type { MenuTriggerProps, MenuTriggerState } from './trigger/MenuTrigger.vue';

/**
 * Displays an element positioned against the menu anchor.
 * Renders a `<div>` element.
 */
export const Arrow: typeof MenuArrow = MenuArrow;
export namespace Arrow {
  export type State = MenuArrowState;
  export type Props = MenuArrowProps;
}

/**
 * An overlay displayed beneath the menu popup.
 * Renders a `<div>` element.
 */
export const Backdrop: typeof MenuBackdrop = MenuBackdrop;
export namespace Backdrop {
  export type State = MenuBackdropState;
  export type Props = MenuBackdropProps;
}

/**
 * A container for the menu items.
 * Renders a `<div>` element.
 */
export const Popup: typeof MenuPopup = MenuPopup;
export namespace Popup {
  export type Props = MenuPopupProps;
  export type State = MenuPopupState;
}

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 */
export const Portal: typeof MenuPortal = MenuPortal;
export namespace Portal {
  export type State = MenuPortalState;
  export type Props = MenuPortalProps;
}

/**
 * Positions the menu popup against the trigger.
 * Renders a `<div>` element.
 */
export const Positioner: typeof MenuPositioner = MenuPositioner;
export namespace Positioner {
  export type State = MenuPositionerState;
  export type Props = MenuPositionerProps;
}

/**
 * Groups all parts of the menu.
 * Doesn't render its own HTML element.
 */
export const Root: typeof MenuRoot = MenuRoot;
export namespace Root {
  export type State = MenuRootState;
  export type Props<Payload = unknown> = MenuRootProps<Payload>;
  export type Actions = MenuRootActions;
  export type ChangeEventReason = MenuRootChangeEventReason;
  export type ChangeEventDetails = MenuRootChangeEventDetails;
  export type HighlightEventReason = MenuRootHighlightEventReason;
  export type HighlightEventDetails = MenuRootHighlightEventDetails;
  export type Orientation = MenuRootOrientation;
}

/**
 * A button that opens the menu.
 * Renders a `<button>` element. While the trigger owns the open menu, a focus guard is before the
 * button and a focus guard is after it in the DOM. A trigger in a menubar has no guards.
 */
export const Trigger: typeof MenuTrigger = MenuTrigger;
export namespace Trigger {
  export type Props<Payload = unknown> = MenuTriggerProps<Payload>;
  export type State = MenuTriggerState;
}

export { MenuHandle as Handle, createMenuHandle as createHandle } from './store/MenuHandle';
