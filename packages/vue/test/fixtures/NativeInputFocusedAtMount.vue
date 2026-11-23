<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue';

// A native input that gives itself the focus at its mount.
const input = useTemplateRef<HTMLInputElement>('input');
onMounted(() => input.value?.focus());
</script>

<template>
  <input ref="input" />
</template>
