<script setup lang="ts">
defineProps<{ modal?: boolean; open?: boolean }>();
</script>

<template>
  <div data-host><slot /></div>
</template>
