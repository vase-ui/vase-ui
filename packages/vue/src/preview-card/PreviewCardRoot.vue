<script setup lang="ts" generic="Payload = unknown">
import { usePreviewCardRoot } from './root';
import type { PreviewCardRootChangeEventDetails, PreviewCardRootProps } from './types';

const props = withDefaults(defineProps<PreviewCardRootProps<Payload>>(), {
  open: undefined,
  defaultOpen: false,
  triggerId: undefined,
  defaultTriggerId: null,
  handle: undefined,
});
const emit = defineEmits<{
  /** The preview card opens or closes. `details.cancel()` keeps it as it was. */
  openChange: [open: boolean, details: PreviewCardRootChangeEventDetails];
  /** Comes after `openChange`, unless a listener cancels the change. `v-model:open` uses it. */
  'update:open': [open: boolean];
  /** The active trigger changes. `v-model:trigger-id` uses it. */
  'update:triggerId': [id: string | null];
}>();
defineSlots<{
  /** The content of the preview card. `payload` is the payload of the active trigger. */
  default?(scope: { payload: Payload | undefined }): unknown;
}>();

const { root, close } = usePreviewCardRoot<Payload>(props, emit);

defineExpose({ close });
</script>

<template>
  <slot :payload="root.payload" />
</template>
