<script setup lang="ts">
import { Slider } from '@vase-ui/vue/slider';
</script>

<template>
  <Slider.Root :default-value="[25, 75]">
    <Slider.Label>Price range</Slider.Label>
    <Slider.Control>
      <Slider.Track>
        <Slider.Indicator />
        <Slider.Thumb aria-label="Minimum price" />
        <Slider.Thumb aria-label="Maximum price" />
      </Slider.Track>
    </Slider.Control>
  </Slider.Root>
</template>
