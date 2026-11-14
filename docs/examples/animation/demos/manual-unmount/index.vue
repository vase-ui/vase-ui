<script setup lang="ts">
import { shallowRef, useTemplateRef } from 'vue';
import { Dialog } from '@vase-ui/vue/dialog';
import { motion } from 'motion-v';
import type { MotionProps } from 'motion-v';

const open = shallowRef(false);
const root = useTemplateRef('root');

function handleOpenChange(nextOpen: boolean, details: Dialog.Root.ChangeEventDetails) {
  if (!nextOpen) {
    details.preventUnmountOnClose();
  }
}

function handleAnimationComplete() {
  if (!open.value) {
    root.value?.unmount();
  }
}
</script>

<template>
  <Dialog.Root ref="root" v-model:open="open" @open-change="handleOpenChange">
    <Dialog.Trigger class="button">Open the dialog</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Popup>
        <template #render="{ props, state }">
          <motion.div
            v-bind="props as MotionProps"
            class="popup"
            :initial="{ height: 0 }"
            :animate="{ height: state.open ? 160 : 0 }"
            @animation-complete="handleAnimationComplete"
          >
            <Dialog.Title>A dialog with motion-v</Dialog.Title>
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
  overflow: hidden;
  box-sizing: border-box;
  width: 20rem;
  max-width: calc(100vw - 2rem);
  margin: auto;
  padding: 0 1.5rem;
  border: 1px solid currentColor;
  background-color: canvas;
  color: canvastext;
}
</style>
