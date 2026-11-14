<script setup lang="ts">
import { Slider } from '@vase-ui/vue/slider';

defineProps<{ label: 'before' | 'after'; explicitIndex?: boolean | undefined }>();
</script>

<template>
  <Slider.Root id="price" :default-value="[25, 75]">
    <Slider.Label v-if="label === 'before'" data-testid="label">Price</Slider.Label>
    <Slider.Control>
      <Slider.Thumb :index="explicitIndex ? 0 : undefined" />
      <Slider.Thumb :index="explicitIndex ? 1 : undefined" />
    </Slider.Control>
    <Slider.Label v-if="label === 'after'" data-testid="label">Price</Slider.Label>
  </Slider.Root>
</template>
