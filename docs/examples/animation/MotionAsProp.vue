<script setup lang="ts">
import { shallowRef } from 'vue';
import { Menu } from '@vase-ui/vue/menu';
import { motion } from 'motion-v';

const open = shallowRef(false);
</script>

<template>
  <Menu.Root v-model:open="open">
    <Menu.Trigger>Trigger</Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner :side-offset="8">
        <Menu.Popup
          :as="motion.div"
          :initial="{ opacity: 0, scale: 0.8 }"
          :animate="{ opacity: open ? 1 : 0, scale: open ? 1 : 0.8 }"
        >
          <Menu.Item>Item</Menu.Item>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
</template>
