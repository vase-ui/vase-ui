<script setup lang="ts">
defineProps<{ modal?: boolean }>();
</script>

<template>
  <div data-host><slot /></div>
</template>
