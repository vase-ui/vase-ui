<script setup lang="ts">
import { motion } from 'motion-v';
import type { MotionProps } from 'motion-v';
import AnimatedPanel from './fixtures/AnimatedPanel.vue';

defineProps<{
  open: boolean;
  /** The duration of each animation, in seconds. */
  duration: number;
}>();

const emit = defineEmits<{
  openChangeComplete: [open: boolean];
}>();
</script>

<template>
  <AnimatedPanel
    :open="open"
    complete-in-later-task
    @open-change-complete="emit('openChangeComplete', $event)"
  >
    <template #render="{ props, state }">
      <motion.div
        v-bind="props as MotionProps"
        data-testid="panel"
        :initial="false"
        :animate="{ opacity: state.open ? 1 : 0 }"
        :transition="{ duration, ease: 'linear' }"
      />
    </template>
  </AnimatedPanel>
</template>
