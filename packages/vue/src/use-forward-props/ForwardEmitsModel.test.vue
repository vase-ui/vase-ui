<script setup lang="ts">
import { ref } from 'vue';
import type { CollapsibleRootChangeEventDetails } from '../collapsible';
import ForwardEmits from './ForwardEmits.test.vue';

const props = defineProps<{
  cancel?: boolean | undefined;
  onChange: (open: boolean, details: CollapsibleRootChangeEventDetails) => void;
  onUpdate: (open: boolean) => void;
}>();
const open = ref(false);
function onOpenChange(value: boolean, details: CollapsibleRootChangeEventDetails) {
  props.onChange(value, details);
  if (props.cancel) {
    details.cancel();
  }
}
</script>

<template>
  <ForwardEmits v-model:open="open" @open-change="onOpenChange" @update:open="onUpdate" />
  <output>{{ open }}</output>
</template>
