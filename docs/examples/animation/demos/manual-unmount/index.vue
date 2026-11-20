<script setup lang="ts">
import { shallowRef, useTemplateRef } from 'vue';
import { Drawer } from '@vase-ui/vue/drawer';
import { motion } from 'motion-v';
import type { MotionProps } from 'motion-v';

const open = shallowRef(false);
const root = useTemplateRef('root');

function handleOpenChange(nextOpen: boolean, details: Drawer.Root.ChangeEventDetails) {
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
  <Drawer.Root ref="root" v-model:open="open" @open-change="handleOpenChange">
    <Drawer.Trigger class="button">Open the drawer</Drawer.Trigger>
    <Drawer.Portal>
      <Drawer.Viewport>
        <Drawer.Popup>
          <template #render="{ props, state }">
            <motion.div
              v-bind="props as MotionProps"
              class="popup"
              :initial="{ height: 0 }"
              :animate="{ height: state.open ? 160 : 0 }"
              @animation-complete="handleAnimationComplete"
            >
              <Drawer.Title>A drawer with motion-v</Drawer.Title>
              <Drawer.Close class="button">Close</Drawer.Close>
            </motion.div>
          </template>
        </Drawer.Popup>
      </Drawer.Viewport>
    </Drawer.Portal>
  </Drawer.Root>
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
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  overflow: hidden;
  box-sizing: border-box;
  width: 20rem;
  max-width: calc(100vw - 2rem);
  padding: 0 1.5rem;
  border: 1px solid currentColor;
  background-color: canvas;
  color: canvastext;
}
</style>
