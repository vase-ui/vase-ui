<script setup lang="ts">
import { Popover } from '@vase-ui/vue/popover';
</script>

<template>
  <Popover.Root>
    <Popover.Trigger data-bench="trigger">Open</Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner>
        <Popover.Popup data-bench="popup">
          <Popover.Arrow />
          <Popover.Title>Title</Popover.Title>
          <Popover.Description>Description</Popover.Description>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
</template>
