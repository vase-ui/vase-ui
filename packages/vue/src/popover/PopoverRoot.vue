<script setup lang="ts" generic="Payload = unknown">
import { usePopoverRoot } from './root';
import type { PopoverRootEmits, PopoverRootProps } from './types';

const props = withDefaults(defineProps<PopoverRootProps<Payload>>(), {
  open: undefined,
  defaultOpen: false,
  triggerId: undefined,
  defaultTriggerId: null,
  modal: false,
  handle: undefined,
});
const emit = defineEmits<PopoverRootEmits>();
defineSlots<{
  /** The content of the popover. `payload` is the payload of the active trigger. */
  default?(scope: { payload: Payload | undefined }): unknown;
}>();

const { root, close } = usePopoverRoot<Payload>(props, emit);

defineExpose({
  /** Closes the popover with the reason `'imperative-action'`. */
  close,
});
</script>

<template>
  <slot :payload="root.payload" />
</template>
