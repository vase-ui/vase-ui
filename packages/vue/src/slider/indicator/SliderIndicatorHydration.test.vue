<script setup lang="ts">
import { Slider } from '@vase-ui/vue/slider';

withDefaults(
  defineProps<{
    defaultValue: number | number[];
    alignment?: 'center' | 'edge' | 'edge-client-only' | undefined;
    orientation?: 'horizontal' | 'vertical' | undefined;
  }>(),
  { alignment: 'center', orientation: 'horizontal' },
);
</script>

<template>
  <Slider.Root
    :default-value="defaultValue"
    :thumb-alignment="alignment"
    :orientation="orientation"
    style="width: 200px"
  >
    <Slider.Control style="position: relative; width: 100%; height: 10px">
      <Slider.Track style="position: relative; width: 100%; height: 10px">
        <Slider.Indicator data-testid="indicator" />
        <template v-if="Array.isArray(defaultValue)">
          <Slider.Thumb
            v-for="(_, index) in defaultValue"
            :key="index"
            style="width: 40px; height: 10px"
          />
        </template>
        <Slider.Thumb v-else style="width: 40px; height: 10px" />
      </Slider.Track>
    </Slider.Control>
  </Slider.Root>
</template>
