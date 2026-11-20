<script setup lang="ts">
import type { PropType } from 'vue';
import { Toast } from '../../src/toast';

type Props = Record<string, unknown>;

defineProps({
  positioner: Object as PropType<Props>,
  group: { type: Object as PropType<Props>, default: () => ({}) },
});
const manager = Toast.useToastManager();
defineExpose({ manager });
</script>

<template>
  <Toast.Viewport aria-label="Anchored notifications">
    <TransitionGroup name="toast" v-bind="group">
      <Toast.Positioner
        v-for="toast in manager.toasts.value"
        :key="toast.id"
        :toast="toast"
        data-testid="positioner"
        v-bind="positioner"
      >
        <Toast.Root :toast="toast" :data-id="toast.id">
          <Toast.Arrow data-testid="arrow" style="width: 10px; height: 5px" />
          <Toast.Description />
        </Toast.Root>
      </Toast.Positioner>
    </TransitionGroup>
  </Toast.Viewport>
</template>
