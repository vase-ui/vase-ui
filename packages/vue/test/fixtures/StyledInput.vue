<script setup lang="ts">
import { useTemplateRef } from 'vue';

const element = useTemplateRef('element');
defineExpose({ element });
</script>

<template>
  <input ref="element" class="StyledInput" />
</template>
