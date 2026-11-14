<script setup lang="ts">
defineProps<{ size: 'sm' | 'md' | 'lg' }>();
</script>

<template>
  <button :data-size="size"><slot /></button>
</template>
