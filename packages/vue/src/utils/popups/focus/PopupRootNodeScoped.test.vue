<script setup lang="ts">
import type { Component } from 'vue';

defineProps<{ part: Component }>();
</script>

<template>
  <component :is="part" class="part" data-testid="part" />
</template>

<style scoped>
.part {
  outline-style: dashed;
}
</style>
