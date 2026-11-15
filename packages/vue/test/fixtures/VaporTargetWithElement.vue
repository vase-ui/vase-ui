<script setup vapor lang="ts">
import { useTemplateRef } from 'vue';

const element = useTemplateRef<HTMLButtonElement>('button');

defineExpose({ element });
</script>

<template>
  <button ref="button" data-testid="vapor-target"><slot /></button>
</template>
