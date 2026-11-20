<script setup lang="ts">
import { useTemplateRef } from 'vue';

const element = useTemplateRef('element');
defineExpose({ element });
</script>

<template>
  <button ref="element" class="StyledButton"><slot /></button>
</template>
