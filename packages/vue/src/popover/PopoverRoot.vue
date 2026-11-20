<script setup lang="ts" generic="Payload = unknown">
import { usePopoverRoot } from './root';
import type { PopoverRootChangeEventDetails, PopoverRootProps } from './types';

const props = withDefaults(defineProps<PopoverRootProps<Payload>>(), {
  open: undefined,
  defaultOpen: false,
  triggerId: undefined,
  defaultTriggerId: null,
  modal: false,
  handle: undefined,
});
const emit = defineEmits<{
  /** The popover opens or closes. `details.cancel()` keeps it as it was. */
  openChange: [open: boolean, details: PopoverRootChangeEventDetails];
  /** Comes after `openChange`, unless a listener cancels the change. `v-model:open` uses it. */
  'update:open': [open: boolean];
  /** The active trigger changes. `v-model:trigger-id` uses it. */
  'update:triggerId': [id: string | null];
}>();
defineSlots<{
  /** The content of the popover. `payload` is the payload of the active trigger. */
  default?(scope: { payload: Payload | undefined }): unknown;
}>();

const { root, close } = usePopoverRoot<Payload>(props, emit);

defineExpose({ close });
</script>

<template>
  <slot :payload="root.payload" />
</template>
