<script setup lang="ts">
// A part with a number prop and a Boolean prop, as `Calendar.Root` has `minDays` and `multiple`.
defineProps({ minDays: Number, multiple: Boolean });
</script>

<template>
  <span :data-min-days="String(minDays)" :data-multiple="String(multiple)" />
</template>
