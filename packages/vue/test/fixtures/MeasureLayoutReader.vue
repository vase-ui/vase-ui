<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue';

// Reads its width in `onMounted`, as a chart or an editor does.
const element = useTemplateRef<HTMLElement>('element');
onMounted(() => element.value!.offsetWidth);
</script>

<template>
  <div ref="element" />
</template>
