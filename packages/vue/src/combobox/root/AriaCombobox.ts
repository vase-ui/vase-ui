import type {
  VaseUIChangeEventDetails,
  VaseUIHighlightEventDetails,
} from '../../internals/createBaseUIEventDetails';
import type { REASONS } from '../../internals/reasons';

export namespace AriaCombobox {
  export interface Actions {
    unmount: () => void;
    close: () => void;
  }

  export type HighlightEventReason =
    typeof REASONS.keyboard | typeof REASONS.pointer | typeof REASONS.none;
  export type HighlightEventDetails = VaseUIHighlightEventDetails<
    HighlightEventReason,
    { index: number }
  >;

  export type ChangeEventReason =
    | typeof REASONS.triggerPress
    | typeof REASONS.inputPress
    | typeof REASONS.outsidePress
    | typeof REASONS.itemPress
    | typeof REASONS.closePress
    | typeof REASONS.escapeKey
    | typeof REASONS.listNavigation
    | typeof REASONS.focusOut
    | typeof REASONS.inputChange
    | typeof REASONS.inputClear
    | typeof REASONS.clearPress
    | typeof REASONS.chipRemovePress
    | typeof REASONS.cancelOpen
    | typeof REASONS.imperativeAction
    | typeof REASONS.none;
  export type OpenChangeEventDetails = ChangeEventDetails & {
    /** Prevents the popup from unmounting until the `unmount` action is called. */
    preventUnmountOnClose: () => void;
  };
  export type ChangeEventDetails = VaseUIChangeEventDetails<ChangeEventReason> & {
    /**
     * When `reason` is `input-clear` in multiple mode, indicates whether an item press caused the
     * clear. Automatic cleanup clears omit this property.
     */
    isItemPress?: boolean | undefined;
  };
}
