<script setup lang="ts">
import { Popover } from '@ark-ui/vue/popover';
</script>

<template>
  <Popover.Root>
    <Popover.Trigger data-bench="trigger">Open</Popover.Trigger>
    <Teleport to="body">
      <Popover.Positioner>
        <Popover.Content data-bench="popup">
          <Popover.Arrow>
            <Popover.ArrowTip />
          </Popover.Arrow>
          <Popover.Title>Title</Popover.Title>
          <Popover.Description>Description</Popover.Description>
        </Popover.Content>
      </Popover.Positioner>
    </Teleport>
  </Popover.Root>
</template>
