<script setup lang="ts">
import { shallowRef } from 'vue';
import { Drawer } from '@vase-ui/vue/drawer';
import { motion } from 'motion-v';

const open = shallowRef(false);
</script>

<template>
  <Drawer.Root v-model:open="open">
    <Drawer.Trigger>Trigger</Drawer.Trigger>
    <Drawer.Portal>
      <Drawer.Viewport>
        <Drawer.Popup
          :as="motion.div"
          :initial="{ opacity: 0, scale: 0.8 }"
          :animate="{ opacity: open ? 1 : 0, scale: open ? 1 : 0.8 }"
        >
          Popup
        </Drawer.Popup>
      </Drawer.Viewport>
    </Drawer.Portal>
  </Drawer.Root>
</template>
