<script setup lang="ts">
import { shallowRef } from 'vue';
import { Dialog } from '@vase-ui/vue/dialog';
import { motion } from 'motion-v';

const open = shallowRef(false);
</script>

<template>
  <Dialog.Root v-model:open="open">
    <Dialog.Trigger>Trigger</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Popup
        :as="motion.div"
        :initial="{ opacity: 0, scale: 0.8 }"
        :animate="{ opacity: open ? 1 : 0, scale: open ? 1 : 0.8 }"
      >
        Popup
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>
