<script setup lang="ts">
import { useTemplateRef } from 'vue';

// A component of a developer that renders `tag` and exposes its element as `element`.
defineProps<{ tag: string }>();
const element = useTemplateRef<HTMLElement>('element');
defineExpose({ element });
</script>

<template>
  <component :is="tag" ref="element"><slot /></component>
</template>
