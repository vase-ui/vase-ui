<script setup lang="ts">
import MeasureTeleportPart from './MeasureTeleportPart.vue';

// A scoped style, a part with an element root and a part with a `<Teleport>` root.
</script>

<template>
  <div class="plain" data-name="plain" />
  <MeasureTeleportPart :to="null" show data-name="teleported" />
</template>

<style scoped>
div {
  outline: 1px solid;
}
</style>
