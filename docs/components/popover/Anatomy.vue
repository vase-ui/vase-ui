<script setup lang="ts">
import { Popover } from '@vase-ui/vue/popover';
</script>

<template>
  <Popover.Root>
    <Popover.Trigger />
    <Popover.Portal>
      <Popover.Backdrop />
      <Popover.Positioner>
        <Popover.Popup>
          <Popover.Arrow />
          <Popover.Viewport>
            <Popover.Title />
            <Popover.Description />
            <Popover.Close />
          </Popover.Viewport>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
</template>
