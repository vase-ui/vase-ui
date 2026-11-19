<script setup lang="ts">
import type { PropType } from 'vue';
import { Meter } from '../../src/meter';

defineProps({
  scene: { type: Object as PropType<{ label: 'first' | 'second' | 'none' }>, required: true },
  target: { type: Object as PropType<Element>, required: true },
});
</script>

<template>
  <Meter.Root :value="30">
    <Teleport :to="target">
      <Meter.Label v-if="scene.label === 'first'" id="first">First</Meter.Label>
      <Meter.Label v-else-if="scene.label === 'second'" id="second">Second</Meter.Label>
    </Teleport>
  </Meter.Root>
</template>
