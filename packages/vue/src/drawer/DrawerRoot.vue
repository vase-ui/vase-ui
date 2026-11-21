<script setup lang="ts" generic="Payload = unknown">
import { useDrawerRoot } from './root';
import type { DrawerRootEmits, DrawerRootProps } from './types';

const props = withDefaults(defineProps<DrawerRootProps<Payload>>(), {
  open: undefined,
  defaultOpen: false,
  triggerId: undefined,
  defaultTriggerId: null,
  modal: true,
  disablePointerDismissal: false,
  handle: undefined,
  swipeDirection: 'down',
  snapPoints: undefined,
  snapPoint: undefined,
  defaultSnapPoint: undefined,
  snapToSequentialPoints: false,
});
const emit = defineEmits<DrawerRootEmits>();
defineSlots<{
  /** The content of the drawer. `payload` is the payload of the active trigger. */
  default?(scope: { payload: Payload | undefined }): unknown;
}>();

const { root, close } = useDrawerRoot<Payload>(props, emit);

defineExpose({
  /** Closes the drawer with the reason `'imperative-action'`. */
  close,
});
</script>

<template>
  <slot :payload="root.payload" />
</template>
