<script lang="ts">
export interface SampleRootState {}

export type SampleRootChangeEventReason = 'trigger-press' | 'escape-key' | 'none';

export interface SampleRootChangeEventDetails {
  reason: SampleRootChangeEventReason;
  event: Event;
  cancel: () => void;
  isCanceled: boolean;
}

export interface SampleRootProps {
  /** Whether the sample is initially open. */
  defaultOpen?: boolean | undefined;
  /** Whether the sample is currently open. */
  open?: boolean | undefined;
}
</script>

<script setup lang="ts" generic="Payload = unknown">
import { computed, ref } from 'vue';

const props = withDefaults(defineProps<SampleRootProps>(), {
  defaultOpen: false,
  open: undefined,
});

const emit = defineEmits<{
  /** Fires first, with the details. A listener can cancel the change. */
  openChange: [open: boolean, details: SampleRootChangeEventDetails];
  /** Fires second, unless the details cancel the change. */
  'update:open': [open: boolean];
  /** Fires after the animations of the change end. */
  openChangeComplete: [open: boolean];
}>();

defineSlots<{
  default(props: { payload: Payload | undefined }): unknown;
}>();

const uncontrolled = ref(props.defaultOpen);
const isOpen = computed(() => (props.open !== undefined ? props.open : uncontrolled.value));
const payload = ref<Payload>();

function close() {
  if (!isOpen.value) {
    return;
  }
  let isCanceled = false;
  const details: SampleRootChangeEventDetails = {
    reason: 'none',
    event: new Event('vase-ui'),
    cancel() {
      isCanceled = true;
    },
    get isCanceled() {
      return isCanceled;
    },
  };
  emit('openChange', false, details);
  if (isCanceled) {
    return;
  }
  emit('update:open', false);
  uncontrolled.value = false;
  emit('openChangeComplete', false);
}

function unmount() {
  payload.value = undefined;
}

defineExpose({ close, unmount });
</script>

<template>
  <slot :payload="payload" />
</template>
