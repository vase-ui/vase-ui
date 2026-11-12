<script setup lang="ts">
import { Button } from '@vase-ui/vue/button';
</script>

<template>
  <div class="buttons">
    <Button class="button">Submit</Button>
    <Button class="button" disabled focusable-when-disabled>Disabled</Button>
  </div>
</template>

<style scoped>
.buttons {
  display: flex;
  gap: 0.75rem;
}

.button {
  height: 2rem;
  padding: 0 0.75rem;
  border: 1px solid currentColor;
  background-color: transparent;
  color: inherit;
  font-size: 0.875rem;
}

.button:hover:not([data-disabled]) {
  background-color: color-mix(in srgb, currentColor 10%, transparent);
}

.button[data-disabled] {
  opacity: 0.5;
}

.button:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
</style>
