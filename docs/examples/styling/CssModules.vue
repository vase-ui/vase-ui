<script setup lang="ts">
import { Tooltip } from '@vase-ui/vue/tooltip';
</script>

<template>
  <Tooltip.Root>
    <Tooltip.Trigger :class="$style.Button">Song</Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Positioner :class="$style.Positioner" :side-offset="8">
        <Tooltip.Popup :class="$style.Popup">Add to Library</Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>
</template>

<style module>
.Button {
  height: 2rem;
  padding: 0 0.75rem;
}

.Positioner {
  outline: 0;
}

.Popup {
  padding: 0.5rem 1rem;
  transition: opacity 150ms;
}

.Popup[data-starting-style],
.Popup[data-ending-style] {
  opacity: 0;
}
</style>
