<script setup lang="ts">
import { Tooltip, TooltipPositionerCssVariables } from '@vase-ui/vue/tooltip';

const popupStyle = {
  maxHeight: `var(${TooltipPositionerCssVariables.availableHeight})`,
};
</script>

<template>
  <Tooltip.Root>
    <Tooltip.Trigger>Song</Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Positioner>
        <Tooltip.Popup :style="popupStyle">Add to Library</Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>
</template>
