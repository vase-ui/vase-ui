<script setup lang="ts">
import { Popover } from '@vase-ui/vue/popover';

const demoPopover = Popover.createHandle();
</script>

<template>
  <Popover.Trigger :handle="demoPopover">Trigger</Popover.Trigger>

  <Popover.Root :handle="demoPopover">
    <Popover.Portal>
      <Popover.Positioner>
        <Popover.Popup>Popover</Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
</template>
