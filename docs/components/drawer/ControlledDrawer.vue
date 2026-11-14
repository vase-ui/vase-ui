<script setup lang="ts">
import { shallowRef } from 'vue';
import { Drawer } from '@vase-ui/vue/drawer';

const open = shallowRef(false);
</script>

<template>
  <Drawer.Root v-model:open="open">
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
