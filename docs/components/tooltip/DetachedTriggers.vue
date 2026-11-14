<script setup lang="ts">
import { Tooltip } from '@vase-ui/vue/tooltip';

const demoTooltip = Tooltip.createHandle();
</script>

<template>
  <Tooltip.Trigger :handle="demoTooltip">Button</Tooltip.Trigger>

  <Tooltip.Root :handle="demoTooltip">
    <Tooltip.Portal>
      <Tooltip.Positioner>
        <Tooltip.Popup>Tooltip</Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>
</template>
