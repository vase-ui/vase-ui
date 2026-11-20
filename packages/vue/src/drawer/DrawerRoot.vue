<script setup lang="ts" generic="Payload = unknown">
import { useDrawerRoot } from './root';
import type {
  DrawerRootChangeEventDetails,
  DrawerRootProps,
  DrawerRootSnapPointChangeEventDetails,
  DrawerSnapPoint,
} from './types';

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
const emit = defineEmits<{
  /** The drawer opens or closes. `details.cancel()` keeps it as it was. */
  openChange: [open: boolean, details: DrawerRootChangeEventDetails];
  /** Comes after `openChange`, unless a listener cancels the change. `v-model:open` uses it. */
  'update:open': [open: boolean];
  /** The active trigger changes. `v-model:trigger-id` uses it. */
  'update:triggerId': [id: string | null];
  /** The snap point changes. `details.cancel()` keeps it as it was. */
  snapPointChange: [point: DrawerSnapPoint | null, details: DrawerRootSnapPointChangeEventDetails];
  /** Comes after `snapPointChange`, unless a listener cancels the change. `v-model:snap-point` uses it. */
  'update:snapPoint': [point: DrawerSnapPoint | null];
}>();
defineSlots<{
  /** The content of the drawer. `payload` is the payload of the active trigger. */
  default?(scope: { payload: Payload | undefined }): unknown;
}>();

const { root, close } = useDrawerRoot<Payload>(props, emit);

defineExpose({ close });
</script>

<template>
  <slot :payload="root.payload" />
</template>
