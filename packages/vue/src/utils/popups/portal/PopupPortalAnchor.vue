<script setup lang="ts">
import { useTemplateRef } from 'vue';

defineProps<{ to: Element | ShadowRoot; disabled: boolean }>();
const anchor = useTemplateRef('anchor');
defineExpose({ anchor });
</script>

<template>
  <span ref="anchor" hidden>
    <Teleport :to="to" :disabled="disabled"><slot /></Teleport>
  </span>
</template>
