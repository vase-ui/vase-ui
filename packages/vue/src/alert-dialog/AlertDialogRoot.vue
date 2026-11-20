<script setup lang="ts" generic="Payload = unknown">
import { useDialogRoot } from '../dialog/root';
import type { AlertDialogRootChangeEventDetails, AlertDialogRootProps } from './types';

const props = withDefaults(defineProps<AlertDialogRootProps<Payload>>(), {
  open: undefined,
  defaultOpen: false,
  triggerId: undefined,
  defaultTriggerId: null,
  handle: undefined,
});
const emit = defineEmits<{
  /** The alert dialog opens or closes. `details.cancel()` keeps it as it was. */
  openChange: [open: boolean, details: AlertDialogRootChangeEventDetails];
  /** Comes after `openChange`, unless a listener cancels the change. `v-model:open` uses it. */
  'update:open': [open: boolean];
  /** The active trigger changes. `v-model:trigger-id` uses it. */
  'update:triggerId': [id: string | null];
}>();
defineSlots<{
  /** The content of the alert dialog. `payload` is the payload of the active trigger. */
  default?(scope: { payload: Payload | undefined }): unknown;
}>();

const { root, close } = useDialogRoot<Payload>('alertdialog', props, emit);

defineExpose({
  /** Closes the alert dialog with the reason `'imperative-action'`. */
  close,
});
</script>

<template>
  <slot :payload="root.payload" />
</template>
