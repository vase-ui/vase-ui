<script setup lang="ts">
import { Tooltip } from '@vase-ui/vue/tooltip';

const demoTooltip = Tooltip.createHandle();
</script>

<template>
  <Tooltip.Trigger :handle="demoTooltip">Trigger 1</Tooltip.Trigger>

  <Tooltip.Trigger :handle="demoTooltip">Trigger 2</Tooltip.Trigger>

  <Tooltip.Root :handle="demoTooltip">
    <Tooltip.Portal>
      <Tooltip.Positioner>
        <Tooltip.Popup>Tooltip</Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>
</template>
