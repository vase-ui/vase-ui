<script setup lang="ts" generic="Payload = unknown">
import { useDialogRoot } from './root';
import type { DialogRootChangeEventDetails, DialogRootProps } from './types';

const props = withDefaults(defineProps<DialogRootProps<Payload>>(), {
  open: undefined,
  defaultOpen: false,
  triggerId: undefined,
  defaultTriggerId: null,
  modal: true,
  disablePointerDismissal: false,
  handle: undefined,
});
const emit = defineEmits<{
  /** The dialog opens or closes. `details.cancel()` keeps it as it was. */
  openChange: [open: boolean, details: DialogRootChangeEventDetails];
  /** Comes after `openChange`, unless a listener cancels the change. `v-model:open` uses it. */
  'update:open': [open: boolean];
  /** The active trigger changes. `v-model:trigger-id` uses it. */
  'update:triggerId': [id: string | null];
}>();
defineSlots<{
  /** The content of the dialog. `payload` is the payload of the active trigger. */
  default?(scope: { payload: Payload | undefined }): unknown;
}>();

const { root, close } = useDialogRoot<Payload>('dialog', props, emit);

defineExpose({ close });
</script>

<template>
  <slot :payload="root.payload" />
</template>
