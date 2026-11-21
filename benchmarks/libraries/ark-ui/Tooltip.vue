<script setup lang="ts">
import { Tooltip } from '@ark-ui/vue/tooltip';
</script>

<template>
  <Tooltip.Root>
    <Tooltip.Trigger data-bench="trigger">Trigger</Tooltip.Trigger>
    <Teleport to="body">
      <Tooltip.Positioner>
        <Tooltip.Content data-bench="popup">Tooltip</Tooltip.Content>
      </Tooltip.Positioner>
    </Teleport>
  </Tooltip.Root>
</template>
