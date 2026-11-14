<script setup lang="ts">
import { Popover } from '@vase-ui/vue/popover';
</script>

<template>
  <Popover.Root>
    <Popover.Trigger>Trigger 1</Popover.Trigger>
    <Popover.Trigger>Trigger 2</Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner>
        <Popover.Popup>Popover</Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
</template>
