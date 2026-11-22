<script setup lang="ts">
import { useTemplateRef } from 'vue';

// A heading of a developer that shows `content.text` and exposes its element. A change of the text
// renders this component only, and not the component around it.
defineProps<{ content: { text: string } }>();
const element = useTemplateRef<HTMLElement>('element');
defineExpose({ element });
</script>

<template>
  <h3 ref="element">{{ content.text }}</h3>
</template>
