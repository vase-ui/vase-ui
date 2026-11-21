<script setup lang="ts" generic="Payload = unknown">
import { useDialogRoot } from '../dialog/root';
import type { AlertDialogRootEmits, AlertDialogRootProps } from './types';

const props = withDefaults(defineProps<AlertDialogRootProps<Payload>>(), {
  open: undefined,
  defaultOpen: false,
  triggerId: undefined,
  defaultTriggerId: null,
  handle: undefined,
});
const emit = defineEmits<AlertDialogRootEmits>();
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
