<script setup lang="ts">
import { Tooltip } from '@vase-ui/vue/tooltip';

const demoTooltip = Tooltip.createHandle<{ text: string }>();
</script>

<template>
  <Tooltip.Trigger :handle="demoTooltip" :payload="{ text: 'Trigger 1' }">
    Trigger 1
  </Tooltip.Trigger>

  <Tooltip.Trigger :handle="demoTooltip" :payload="{ text: 'Trigger 2' }">
    Trigger 2
  </Tooltip.Trigger>

  <Tooltip.Root v-slot="{ payload }" :handle="demoTooltip">
    <Tooltip.Portal>
      <Tooltip.Positioner :side-offset="8">
        <Tooltip.Popup>
          <Tooltip.Arrow />
          <span v-if="payload !== undefined">Tooltip opened by {{ payload.text }}</span>
        </Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>
</template>
