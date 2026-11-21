<script setup lang="ts" generic="Payload = unknown">
import { useTooltipRoot } from './root';
import type { TooltipRootEmits, TooltipRootProps } from './types';

const props = withDefaults(defineProps<TooltipRootProps<Payload>>(), {
  open: undefined,
  defaultOpen: false,
  triggerId: undefined,
  defaultTriggerId: null,
  handle: undefined,
  disabled: false,
  disableHoverablePopup: false,
  trackCursorAxis: 'none',
});
const emit = defineEmits<TooltipRootEmits>();
defineSlots<{
  /** The content of the tooltip. `payload` is the payload of the active trigger. */
  default?(scope: { payload: Payload | undefined }): unknown;
}>();

const { root, close } = useTooltipRoot<Payload>(props, emit);

defineExpose({
  /** Closes the tooltip with the reason `'imperative-action'`. */
  close,
});
</script>

<template>
  <slot :payload="root.payload" />
</template>
