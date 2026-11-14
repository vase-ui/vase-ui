<script setup lang="ts">
import { shallowRef } from 'vue';
import { Drawer } from '@vase-ui/vue/drawer';

const snapPoints = ['148px', 1];
const snapPoint = shallowRef<Drawer.Root.SnapPoint | null>(snapPoints[0]);
</script>

<template>
  <Drawer.Root v-model:snap-point="snapPoint" :snap-points="snapPoints">
    <Drawer.Trigger>Open</Drawer.Trigger>
    <Drawer.Portal>
      <Drawer.Viewport>
        <Drawer.Popup>Drawer</Drawer.Popup>
      </Drawer.Viewport>
    </Drawer.Portal>
  </Drawer.Root>
</template>
