<script setup lang="ts">
import { Slider } from '@vase-ui/vue/slider';

defineProps<{
  defaultValue: number | number[];
  alignment?: 'center' | 'edge' | undefined;
}>();
</script>

<template>
  <Slider.Root :default-value="defaultValue" :thumb-alignment="alignment" style="width: 100px">
    <Slider.Value />
    <Slider.Control>
      <Slider.Track>
        <template v-if="Array.isArray(defaultValue)">
          <Slider.Thumb
            v-for="(_, index) in defaultValue"
            :key="index"
            :index="index"
            data-testid="thumb"
          />
        </template>
        <template v-else>
          <Slider.Indicator />
          <Slider.Thumb data-testid="thumb" />
        </template>
      </Slider.Track>
    </Slider.Control>
  </Slider.Root>
</template>
