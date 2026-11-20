<script setup lang="ts">
import { Resizable } from '@vase-ui/vue/resizable';
</script>

<template>
  <Resizable.Root
    @keydown.capture="
      (event: KeyboardEvent) => {
        if (event.key === 'F6') event.preventDefault();
      }
    "
  >
    <Resizable.Panel />
    <Resizable.Handle aria-label="Resize the first panel" />
    <Resizable.Panel />
  </Resizable.Root>
</template>
