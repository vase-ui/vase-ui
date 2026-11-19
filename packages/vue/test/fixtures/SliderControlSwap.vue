<script setup lang="ts">
import type { PropType } from 'vue';
import { Slider } from '../../src/slider';

// The control renders the element `scene.tag`, while `scene.shown`.
defineProps({
  root: Object as PropType<Record<string, unknown>>,
  scene: { type: Object as PropType<{ tag: string; shown: boolean }>, required: true },
});
</script>

<template>
  <Slider.Root :default-value="40" aria-label="Volume" v-bind="root">
    <Slider.Control v-if="scene.shown">
      <template #element="{ props, elementRef }">
        <component
          :is="scene.tag"
          v-bind="props"
          :ref="elementRef"
          style="display: block; width: 100px; height: 10px"
        >
          <Slider.Track style="width: 100%; height: 100%">
            <Slider.Thumb style="width: 10px; height: 10px" />
          </Slider.Track>
        </component>
      </template>
    </Slider.Control>
  </Slider.Root>
</template>
