<script setup lang="ts">
import { Tooltip } from '@vase-ui/vue/tooltip';
</script>

<template>
  <Tooltip.Provider>
    <Tooltip.Root>
      <Tooltip.Trigger />
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Popup>
            <Tooltip.Arrow />
            <Tooltip.Viewport />
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  </Tooltip.Provider>
</template>
