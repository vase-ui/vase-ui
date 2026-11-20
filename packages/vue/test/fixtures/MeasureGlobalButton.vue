<script setup lang="ts">
defineProps({ is: { type: String, required: true } });
</script>

<template>
  <component :is="is" data-probe="">Text</component>
</template>
