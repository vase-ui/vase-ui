<script setup lang="ts">
import { Drawer } from '@vase-ui/vue/drawer';
</script>

<template>
  <Drawer.Root>
    <Drawer.Trigger>Open</Drawer.Trigger>
    <Drawer.Portal>
      <Drawer.Viewport>
        <Drawer.Popup>
          <Drawer.Content>
            <Drawer.Title>Example drawer</Drawer.Title>
            <Drawer.Close>Close</Drawer.Close>
          </Drawer.Content>
        </Drawer.Popup>
      </Drawer.Viewport>
    </Drawer.Portal>
  </Drawer.Root>
</template>
