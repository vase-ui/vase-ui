<script setup lang="ts" generic="Payload = unknown">
import { useDialogRoot } from './root';
import type { DialogRootEmits, DialogRootProps } from './types';

const props = withDefaults(defineProps<DialogRootProps<Payload>>(), {
  open: undefined,
  defaultOpen: false,
  triggerId: undefined,
  defaultTriggerId: null,
  modal: true,
  disablePointerDismissal: false,
  handle: undefined,
});
const emit = defineEmits<DialogRootEmits>();
defineSlots<{
  /** The content of the dialog. `payload` is the payload of the active trigger. */
  default?(scope: { payload: Payload | undefined }): unknown;
}>();

const { root, close } = useDialogRoot<Payload>('dialog', props, emit);

defineExpose({
  /** Closes the dialog with the reason `'imperative-action'`. */
  close,
});
</script>

<template>
  <slot :payload="root.payload" />
</template>
