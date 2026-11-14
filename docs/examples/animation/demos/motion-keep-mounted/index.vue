<script setup lang="ts">
import { Dialog } from '@vase-ui/vue/dialog';
import { motion } from 'motion-v';
import type { MotionProps } from 'motion-v';
</script>

<template>
  <Dialog.Root>
    <Dialog.Trigger class="button">Open the dialog</Dialog.Trigger>
    <Dialog.Portal keep-mounted>
      <Dialog.Popup>
        <template #render="{ props, state }">
          <motion.div
            v-bind="props as MotionProps"
            class="popup"
            :initial="{ opacity: 0, scale: 0.8 }"
            :animate="{ opacity: state.open ? 1 : 0, scale: state.open ? 1 : 0.8 }"
          >
            <Dialog.Title>A dialog with motion-v</Dialog.Title>
            <Dialog.Description>The dialog stays in the DOM when it is closed.</Dialog.Description>
            <Dialog.Close class="button">Close</Dialog.Close>
          </motion.div>
        </template>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>

<style scoped>
.button {
  height: 2rem;
  padding: 0 0.75rem;
  border: 1px solid currentColor;
  background-color: transparent;
  color: inherit;
  font-size: 0.875rem;
}

.popup {
  position: fixed;
  inset: 0;
  box-sizing: border-box;
  width: 20rem;
  max-width: calc(100vw - 2rem);
  height: fit-content;
  margin: auto;
  padding: 1rem 1.5rem;
  border: 1px solid currentColor;
  background-color: canvas;
  color: canvastext;
}
</style>
