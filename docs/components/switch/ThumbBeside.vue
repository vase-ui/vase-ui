<script setup lang="ts">
import { Switch } from '@vase-ui/vue/switch';
</script>

<template>
  <label class="label">
    <span class="track">
      <Switch class="switch" />
      <span class="thumb" />
    </span>
    Notifications
  </label>
</template>

<style scoped>
.track {
  position: relative;
  display: inline-flex;
}

.switch {
  appearance: none;
  width: 2.25rem;
  height: 1.25rem;
  margin: 0;
  border: 1px solid;
}

.thumb {
  position: absolute;
  top: 0.1875rem;
  left: 0.1875rem;
  width: 0.875rem;
  height: 0.875rem;
  background: currentColor;
  pointer-events: none;
  transition: translate 150ms;
}

.switch:checked + .thumb {
  translate: 1rem 0;
}
</style>
