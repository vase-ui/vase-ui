<script setup lang="ts">
import { Tooltip } from '@vase-ui/vue/tooltip';

function onOpenChange(_open: boolean, eventDetails: Tooltip.Root.ChangeEventDetails) {
  if (eventDetails.reason === 'escape-key') {
    eventDetails.allowPropagation();
  }
}
</script>

<template>
  <Tooltip.Root @open-change="onOpenChange">
    <Tooltip.Trigger>Trigger</Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Positioner>
        <Tooltip.Popup>Tooltip</Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>
</template>
