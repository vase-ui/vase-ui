<script setup lang="ts">
import { onMounted, useTemplateRef, type PropType } from 'vue';
import { focusAtMount, type PopupContentReading } from './popupContent';

const props = defineProps({
  log: { type: Object as PropType<{ add(entry: PopupContentReading): void }>, required: true },
});
const input = useTemplateRef<HTMLInputElement>('input');
onMounted(() => {
  if (input.value) props.log.add(focusAtMount(input.value));
});
</script>

<template>
  <input ref="input" aria-label="Field" data-testid="field" />
</template>
