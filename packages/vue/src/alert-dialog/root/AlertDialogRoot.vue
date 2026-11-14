<script lang="ts">
import type {
  DialogRootChangeEventReason,
  DialogRootProps,
} from '../../dialog/root/DialogRoot.vue';
import type { VaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { AlertDialogHandle } from '../handle';

export interface AlertDialogRootState {}

export interface AlertDialogRootProps<Payload = unknown> extends Omit<
  DialogRootProps<Payload>,
  'modal' | 'disablePointerDismissal' | 'handle'
> {
  /**
   * A handle to associate the alert dialog with a trigger.
   * If specified, allows external triggers to control the alert dialog's open state.
   * Can be created with the AlertDialog.createHandle() method.
   */
  handle?: AlertDialogHandle<Payload> | undefined;
}

export interface AlertDialogRootActions {
  /**
   * Ends the closing phase of the alert dialog after an externally controlled closing animation finishes.
   * Call `preventUnmountOnClose()` in `openChange` first, otherwise the alert dialog completes closing on its own.
   * Whether it leaves the DOM is decided by `keepMounted` on the portal.
   */
  unmount: () => void;
  /**
   * Closes the alert dialog imperatively when called.
   */
  close: () => void;
}

export type AlertDialogRootChangeEventReason = DialogRootChangeEventReason;
export type AlertDialogRootChangeEventDetails =
  VaseUIChangeEventDetails<AlertDialogRootChangeEventReason> & {
    /** Prevents the popup from unmounting until the `unmount` action is called. */
    preventUnmountOnClose: () => void;
  };
</script>

<script setup lang="ts" generic="Payload = unknown">
import { useRenderDialogRoot } from '../../dialog/root/useRenderDialogRoot';

const props = withDefaults(defineProps<AlertDialogRootProps<Payload>>(), {
  open: undefined,
  defaultOpen: false,
  handle: undefined,
  triggerId: undefined,
  defaultTriggerId: null,
});

const emit = defineEmits<{
  /**
   * Event handler called when the alert dialog is opened or closed.
   */
  openChange: [open: boolean, eventDetails: AlertDialogRootChangeEventDetails];
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

const { payload, actions } = useRenderDialogRoot<Payload>('alert-dialog', props, emit);

defineExpose({ unmount: actions.unmount, close: actions.close });
</script>

<template>
  <slot :payload="payload" />
</template>
