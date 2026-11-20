<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue';

// Reads the width of its panel in `onMounted`, as a chart or an editor does.
const emit = defineEmits<{ read: [width: number] }>();
const element = useTemplateRef<HTMLElement>('element');
onMounted(() => emit('read', element.value!.parentElement!.getBoundingClientRect().width));
</script>

<template>
  <div ref="element" />
</template>
