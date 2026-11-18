<script setup lang="ts">
const props = defineProps<{ setupEffect: () => void }>();
props.setupEffect();
</script>

<template>
  <div><slot /></div>
</template>
