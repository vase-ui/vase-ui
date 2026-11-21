<script setup lang="ts">
import { Tooltip } from '@vase-ui/vue/tooltip';
</script>

<template>
  <Tooltip.Provider>
    <Tooltip.Root>
      <Tooltip.Trigger data-bench="trigger">Open</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Popup data-bench="popup">
            <Tooltip.Arrow />
            Tooltip
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  </Tooltip.Provider>
</template>
