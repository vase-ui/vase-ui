<script setup lang="ts">
import { Drawer } from '@vase-ui/vue/drawer';

const demoDrawer = Drawer.createHandle();
</script>

<template>
  <Drawer.Trigger :handle="demoDrawer">Open</Drawer.Trigger>

  <Drawer.Root :handle="demoDrawer">
    <Drawer.Portal>
      <Drawer.Viewport>
        <Transition name="sheet">
          <Drawer.Popup>Drawer</Drawer.Popup>
        </Transition>
      </Drawer.Viewport>
    </Drawer.Portal>
  </Drawer.Root>
</template>
