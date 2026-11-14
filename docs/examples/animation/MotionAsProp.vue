<script setup lang="ts">
import { shallowRef } from 'vue';
import { Popover } from '@vase-ui/vue/popover';
import { motion } from 'motion-v';

const open = shallowRef(false);
</script>

<template>
  <Popover.Root v-model:open="open">
    <Popover.Trigger>Trigger</Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner :side-offset="8">
        <Popover.Popup
          :as="motion.div"
          :initial="{ opacity: 0, scale: 0.8 }"
          :animate="{ opacity: open ? 1 : 0, scale: open ? 1 : 0.8 }"
        >
          Popup
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
</template>
