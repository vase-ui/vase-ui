<script setup lang="ts">
import { useTemplateRef } from 'vue';

const element = useTemplateRef('element');
defineExpose({ element });
</script>

<template>
  <div ref="element" class="StyledDiv" />
</template>
