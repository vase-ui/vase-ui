<script setup lang="ts">
import type { PropType } from 'vue';
import { Slider } from '../../src/slider';

// The label shows while `scene.shown`.
defineProps({
  scene: { type: Object as PropType<{ shown: boolean }>, required: true },
});
</script>

<template>
  <Slider.Root>
    <Slider.Label v-if="scene.shown">Volume</Slider.Label>
    <Slider.Control>
      <Slider.Track>
        <Slider.Thumb />
      </Slider.Track>
    </Slider.Control>
  </Slider.Root>
</template>
