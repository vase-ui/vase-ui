<script setup lang="ts">
import { shallowRef, useTemplateRef } from 'vue';
import { Menu } from '@vase-ui/vue/menu';
import { motion } from 'motion-v';
import type { MotionProps } from 'motion-v';

const open = shallowRef(false);
const root = useTemplateRef('root');

function handleOpenChange(nextOpen: boolean, details: Menu.Root.ChangeEventDetails) {
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
  <Menu.Root ref="root" v-model:open="open" @open-change="handleOpenChange">
    <Menu.Trigger class="button">Open the menu</Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner :side-offset="8">
        <Menu.Popup>
          <template #render="{ props, state }">
            <motion.div
              v-bind="props as MotionProps"
              class="popup"
              :initial="{ height: 0 }"
              :animate="{ height: state.open ? 96 : 0 }"
              @animation-complete="handleAnimationComplete"
            >
              <Menu.Item class="item">Add to library</Menu.Item>
              <Menu.Item class="item">Add to playlist</Menu.Item>
            </motion.div>
          </template>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
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
  overflow: hidden;
  box-sizing: border-box;
  width: 12rem;
  padding: 0 0.25rem;
  border: 1px solid currentColor;
  background-color: canvas;
  color: canvastext;
}

.item {
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  outline: none;
}

.item[data-highlighted] {
  background-color: canvastext;
  color: canvas;
}
</style>
