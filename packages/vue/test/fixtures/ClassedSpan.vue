<script setup lang="ts">
import { useTemplateRef } from 'vue';

const element = useTemplateRef('element');
defineExpose({ element });
</script>

<!-- A span with a class of its own. It exposes its element, as a Vapor component in `as` must. -->
<template>
  <span ref="element" class="Own"><slot /></span>
</template>
