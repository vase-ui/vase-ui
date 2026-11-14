<script setup lang="ts">
import { shallowRef, useTemplateRef } from 'vue';
import { Popover } from '@vase-ui/vue/popover';
import { motion } from 'motion-v';
import type { MotionProps } from 'motion-v';

const open = shallowRef(false);
const root = useTemplateRef('root');

function handleOpenChange(nextOpen: boolean, details: Popover.Root.ChangeEventDetails) {
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
  <Popover.Root ref="root" v-model:open="open" @open-change="handleOpenChange">
    <Popover.Trigger class="button">Open the popover</Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner :side-offset="8">
        <Popover.Popup>
          <template #render="{ props, state }">
            <motion.div
              v-bind="props as MotionProps"
              class="popup"
              :initial="{ height: 0 }"
              :animate="{ height: state.open ? 160 : 0 }"
              @animation-complete="handleAnimationComplete"
            >
              <Popover.Title>A popover with motion-v</Popover.Title>
              <Popover.Close class="button">Close</Popover.Close>
            </motion.div>
          </template>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
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
  width: 20rem;
  max-width: calc(100vw - 2rem);
  padding: 0 1.5rem;
  border: 1px solid currentColor;
  background-color: canvas;
  color: canvastext;
}
</style>
