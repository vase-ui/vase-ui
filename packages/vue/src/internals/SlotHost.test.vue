<script setup lang="ts">
defineProps<{ keepMounted?: boolean; open?: boolean }>();
</script>

<template>
  <div data-host><slot /></div>
</template>
