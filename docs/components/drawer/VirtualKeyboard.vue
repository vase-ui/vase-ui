<script setup lang="ts">
import { Drawer } from '@vase-ui/vue/drawer';
</script>

<template>
  <Drawer.Root>
    <Drawer.Trigger>Open</Drawer.Trigger>
    <Drawer.VirtualKeyboardProvider>
      <Drawer.Portal>
        <Drawer.Viewport>
          <Transition name="sheet">
            <Drawer.Popup>
              <input aria-label="Name" />
            </Drawer.Popup>
          </Transition>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.VirtualKeyboardProvider>
  </Drawer.Root>
</template>
