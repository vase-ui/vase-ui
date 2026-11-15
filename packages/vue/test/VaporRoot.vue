<script setup vapor lang="ts">
import type { Component } from 'vue';

defineProps<{ content: Component }>();
</script>

<template>
  <component :is="content" />
</template>
