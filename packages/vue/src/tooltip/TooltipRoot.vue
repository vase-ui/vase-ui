<script setup lang="ts" generic="Payload = unknown">
import { useTooltipRoot } from './root';
import type { TooltipRootChangeEventDetails, TooltipRootProps } from './types';

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
const emit = defineEmits<{
  /** The tooltip opens or closes. `details.cancel()` keeps it as it was. */
  openChange: [open: boolean, details: TooltipRootChangeEventDetails];
  /** Comes after `openChange`, unless a listener cancels the change. `v-model:open` uses it. */
  'update:open': [open: boolean];
  /** The active trigger changes. `v-model:trigger-id` uses it. */
  'update:triggerId': [id: string | null];
}>();
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
