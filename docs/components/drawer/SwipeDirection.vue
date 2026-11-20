<script setup lang="ts">
import { Drawer } from '@vase-ui/vue/drawer';
</script>

<template>
  <Drawer.Root swipe-direction="right">
    <Drawer.Trigger>Open</Drawer.Trigger>
    <Drawer.Portal>
      <Drawer.Viewport>
        <Transition name="sheet" appear>
          <Drawer.Popup>Drawer</Drawer.Popup>
        </Transition>
      </Drawer.Viewport>
    </Drawer.Portal>
  </Drawer.Root>
</template>
