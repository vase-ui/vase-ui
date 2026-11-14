<script setup lang="ts">
import { Slider } from '@vase-ui/vue/slider';
</script>

<template>
  <Slider.Root>
    <Slider.Label>Volume</Slider.Label>
    <Slider.Control>
      <Slider.Track>
        <Slider.Indicator />
        <Slider.Thumb />
      </Slider.Track>
    </Slider.Control>
  </Slider.Root>
</template>
