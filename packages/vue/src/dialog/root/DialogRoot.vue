<script lang="ts">
import type { VaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { REASONS } from '../../internals/reasons';
import type { DialogHandle } from '../store/DialogHandle';

export interface DialogRootState {}

export interface DialogRootProps<Payload = unknown> {
  /**
   * Whether the dialog is currently open.
   */
  open?: boolean | undefined;
  /**
   * Whether the dialog is initially open.
   *
   * To render a controlled dialog, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Determines if the dialog enters a modal state when open.
   * - `true`: user interaction is limited to just the dialog: focus is trapped, document page scroll is locked, and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   * - `'trap-focus'`: focus is trapped inside the dialog, but document page scroll is not locked and pointer interactions outside of it remain enabled.
   *
   * When `modal` is `true` or `'trap-focus'`, render `<Dialog.Close>` inside `<Dialog.Popup>` so
   * touch screen readers can escape the popup.
   * @default true
   */
  modal?: boolean | 'trap-focus' | undefined;
  /**
   * Whether to prevent the dialog from closing on outside presses.
   * For non-modal dialogs, this also prevents the dialog from closing when focus moves outside of it.
   * @default false
   */
  disablePointerDismissal?: boolean | undefined;
  /**
   * A handle to associate the dialog with a trigger.
   * If specified, allows external triggers to control the dialog's open state.
   * Can be created with the Dialog.createHandle() method.
   */
  handle?: DialogHandle<Payload> | undefined;
  /**
   * ID of the trigger that the dialog is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled dialog.
   * There's no need to specify this prop when the dialog is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
  /**
   * ID of the trigger that the dialog is associated with.
   * This is useful in conjunction with the `defaultOpen` prop to create an initially open dialog.
   */
  defaultTriggerId?: string | null | undefined;
}

export interface DialogRootActions {
  /**
   * Ends the closing phase of the dialog after an externally controlled closing animation finishes.
   * Call `preventUnmountOnClose()` in `openChange` first, otherwise the dialog completes closing on its own.
   * Whether it leaves the DOM is decided by `keepMounted` on the portal.
   */
  unmount: () => void;
  /**
   * Closes the dialog imperatively when called.
   */
  close: () => void;
}

export type DialogRootChangeEventReason =
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.closePress
  | typeof REASONS.focusOut
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;

export type DialogRootChangeEventDetails = VaseUIChangeEventDetails<DialogRootChangeEventReason> & {
  /** Prevents the popup from unmounting until the `unmount` action is called. */
  preventUnmountOnClose: () => void;
};
</script>

<script setup lang="ts" generic="Payload = unknown">
import { useRenderDialogRoot } from './useRenderDialogRoot';

const props = withDefaults(defineProps<DialogRootProps<Payload>>(), {
  open: undefined,
  defaultOpen: false,
  modal: true,
  disablePointerDismissal: false,
  handle: undefined,
  triggerId: undefined,
  defaultTriggerId: null,
});

const emit = defineEmits<{
  /**
   * Event handler called when the dialog is opened or closed.
   */
  openChange: [open: boolean, eventDetails: DialogRootChangeEventDetails];
  'update:open': [open: boolean];
  /**
   * Event handler called after any animations complete when the dialog is opened or closed.
   */
  openChangeComplete: [open: boolean];
}>();

defineSlots<{
  /**
   * The content of the dialog. The slot gets the `payload` of the active trigger.
   */
  default(props: { payload: Payload | undefined }): unknown;
}>();

const { payload, actions } = useRenderDialogRoot<Payload>('dialog', props, emit);

defineExpose({ unmount: actions.unmount, close: actions.close });
</script>

<template>
  <slot :payload="payload" />
</template>
