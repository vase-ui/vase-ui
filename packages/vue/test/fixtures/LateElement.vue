<script setup lang="ts">
import { onMounted, shallowRef, useTemplateRef } from 'vue';

// A component that exposes its element after an await in `onMounted`, as a component that loads
// something first does.
const props = defineProps<{ ready: Promise<void> }>();
const span = useTemplateRef('span');
const element = shallowRef<HTMLElement | null>(null);
onMounted(async () => {
  await props.ready;
  element.value = span.value;
});
defineExpose({ element });
</script>

<template>
  <span ref="span"><slot /></span>
</template>
