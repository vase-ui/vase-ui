<script setup lang="ts" generic="Payload = unknown">
import { usePreviewCardRoot } from './root';
import type { PreviewCardRootEmits, PreviewCardRootProps } from './types';

const props = withDefaults(defineProps<PreviewCardRootProps<Payload>>(), {
  open: undefined,
  defaultOpen: false,
  triggerId: undefined,
  defaultTriggerId: null,
  handle: undefined,
});
const emit = defineEmits<PreviewCardRootEmits>();
defineSlots<{
  /** The content of the preview card. `payload` is the payload of the active trigger. */
  default?(scope: { payload: Payload | undefined }): unknown;
}>();

const { root, close } = usePreviewCardRoot<Payload>(props, emit);

defineExpose({
  /** Closes the preview card with the reason `'imperative-action'`. */
  close,
});
</script>

<template>
  <slot :payload="root.payload" />
</template>
