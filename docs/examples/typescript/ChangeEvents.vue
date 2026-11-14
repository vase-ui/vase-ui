<script setup lang="ts">
import { Tooltip } from '@vase-ui/vue/tooltip';

function onOpenChange(open: boolean, eventDetails: Tooltip.Root.ChangeEventDetails) {
  const reason: Tooltip.Root.ChangeEventReason = eventDetails.reason;
  console.log(open, reason);
}
</script>

<template>
  <Tooltip.Root @open-change="onOpenChange">
    <Tooltip.Trigger>Trigger</Tooltip.Trigger>
  </Tooltip.Root>
</template>
