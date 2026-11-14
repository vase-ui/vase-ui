<script setup lang="ts">
import { Drawer } from '@vase-ui/vue/drawer';
</script>

<template>
  <Drawer.Root>
    <Drawer.Trigger>Open</Drawer.Trigger>
    <Drawer.VirtualKeyboardProvider>
      <Drawer.Portal>
        <Drawer.Viewport>
          <Drawer.Popup>
            <input aria-label="Name" />
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.VirtualKeyboardProvider>
  </Drawer.Root>
</template>
