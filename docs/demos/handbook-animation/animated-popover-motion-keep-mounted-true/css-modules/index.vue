<script setup lang="ts">
import { Popover } from '@vase-ui/vue/popover';
import { motion } from 'motion-v';
import type { MotionProps } from 'motion-v';
import styles from './index.module.css';
</script>

<template>
  <Popover.Root>
    <Popover.Trigger :class="styles.Trigger">Trigger</Popover.Trigger>
    <Popover.Portal keep-mounted>
      <Popover.Positioner :class="styles.Positioner" :side-offset="8">
        <Popover.Popup :class="styles.Popup" aria-label="Animated popover">
          <template #element="{ props, elementRef, state }">
            <motion.div
              v-bind="props as MotionProps"
              :ref="elementRef"
              :initial="false"
              :animate="{ opacity: state.open ? 1 : 0, scale: state.open ? 1 : 0.8 }"
            >
              Popup
            </motion.div>
          </template>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
</template>
