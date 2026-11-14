<script setup lang="ts">
import { Slider } from '@vase-ui/vue/slider';

withDefaults(
  defineProps<{
    defaultValue: number | number[];
    max?: number | undefined;
    format?: Intl.NumberFormatOptions | undefined;
    alignment?: 'center' | 'edge' | 'edge-client-only' | undefined;
    orientation?: 'horizontal' | 'vertical' | undefined;
    name?: string | undefined;
    explicitIndex?: boolean | undefined;
  }>(),
  { max: 100, format: undefined, alignment: 'center', orientation: 'horizontal' },
);
</script>

<template>
  <Slider.Root
    :default-value="defaultValue"
    :max="max"
    :format="format"
    :thumb-alignment="alignment"
    :orientation="orientation"
    :name="name"
    style="width: 200px"
  >
    <Slider.Control style="position: relative; width: 100%; height: 10px">
      <template v-if="Array.isArray(defaultValue)">
        <Slider.Thumb
          v-for="(_, index) in defaultValue"
          :key="index"
          :index="explicitIndex ? index : undefined"
          data-testid="thumb"
          style="width: 40px; height: 10px"
        />
      </template>
      <Slider.Thumb v-else data-testid="thumb" style="width: 40px; height: 10px" />
    </Slider.Control>
  </Slider.Root>
</template>
