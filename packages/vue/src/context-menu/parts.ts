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
 * The area that opens the menu at a right press or at a long press.
 * Renders a `<div>` element.
 */
export const Trigger: typeof ContextMenuTrigger = ContextMenuTrigger;
export namespace Trigger {
  export type Props = ContextMenuTriggerProps;
  export type State = ContextMenuTriggerState;
}

/**
 * Places the popup at the pointer.
 * Renders a `<div>` element.
 */
export const Positioner: typeof ContextMenuPositioner = ContextMenuPositioner;
export namespace Positioner {
  export type Props = ContextMenuPositionerProps;
  export type State = ContextMenuPositionerState;
}
