import ContextMenuPositioner from './ContextMenuPositioner.vue';
import ContextMenuRoot from './ContextMenuRoot.vue';
import ContextMenuTrigger from './ContextMenuTrigger.vue';
import type {
  ContextMenuPositionerProps,
  ContextMenuPositionerState,
  ContextMenuRootChangeEventDetails,
  ContextMenuRootChangeEventReason,
  ContextMenuRootHighlightEventDetails,
  ContextMenuRootHighlightEventReason,
  ContextMenuRootProps,
  ContextMenuRootState,
  ContextMenuTriggerProps,
  ContextMenuTriggerState,
} from './types';

export {
  Arrow,
  Backdrop,
  CheckboxItem,
  Group,
  GroupLabel,
  Item,
  LinkItem,
  Popup,
  Portal,
  RadioGroup,
  RadioItem,
  Separator,
  SubmenuRoot,
  SubmenuTrigger,
} from '../menu/parts';

/**
 * Groups the parts of a menu that opens at the pointer.
 * Renders no element.
 */
export const Root: typeof ContextMenuRoot = ContextMenuRoot;
export namespace Root {
  export type Props = ContextMenuRootProps;
  export type State = ContextMenuRootState;
  export type ChangeEventReason = ContextMenuRootChangeEventReason;
  export type ChangeEventDetails = ContextMenuRootChangeEventDetails;
  export type HighlightEventReason = ContextMenuRootHighlightEventReason;
  export type HighlightEventDetails = ContextMenuRootHighlightEventDetails;
}

/**
 * The area that opens the menu at a right press or at a long press. A long press of a touch or a
 * pen opens the menu after 500 ms, also where the browser sends no `contextmenu` event. A key
 * opens the menu only when the browser sends a `contextmenu` event for it.
 * Renders a `<div>` element.
 * @selector `[data-popup-open]` The menu is open.
 * @selector `[data-pressed]` The menu is open, as with `[data-popup-open]`.
 */
export const Trigger: typeof ContextMenuTrigger = ContextMenuTrigger;
export namespace Trigger {
  export type Props = ContextMenuTriggerProps;
  export type State = ContextMenuTriggerState;
}

/**
 * Places the popup at the pointer.
 * Renders a `<div>` element.
 * @selector `[data-side]` The side of the anchor that the popup is on: `top`, `bottom`, `left`, `right`, `inline-start` or `inline-end`. A logical side shows with a logical `side` prop, and for a submenu with no `side` prop.
 * @selector `[data-align]` The alignment of the popup on its side: `start`, `center` or `end`.
 * @selector `[data-anchor-hidden]` The anchor is out of view.
 * @cssVariable `--anchor-width` The width of the anchor, in pixels.
 * @cssVariable `--anchor-height` The height of the anchor, in pixels.
 * @cssVariable `--available-width` The width from the anchor to the edge of the collision boundary, in pixels.
 * @cssVariable `--available-height` The height from the anchor to the edge of the collision boundary, in pixels.
 * @cssVariable `--transform-origin` The point that the popup grows from.
 */
export const Positioner: typeof ContextMenuPositioner = ContextMenuPositioner;
export namespace Positioner {
  export type Props = ContextMenuPositionerProps;
  export type State = ContextMenuPositionerState;
}
