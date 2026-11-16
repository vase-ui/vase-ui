<script setup lang="ts">
import { Resizable } from '@vase-ui/vue/resizable';
</script>

<template>
  <Resizable.Root
    @keydown="
      (event) => {
        if (event.key === 'F6') {
          event.preventVaseUIHandler();
        }
      }
    "
  >
    <Resizable.Panel />
    <Resizable.Handle aria-label="Resize the first panel" />
    <Resizable.Panel />
  </Resizable.Root>
</template>
