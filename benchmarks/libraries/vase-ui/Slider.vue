<script setup lang="ts">
import { Slider } from '@vase-ui/vue/slider';
</script>

<template>
  <Slider.Root :default-value="50">
    <Slider.Control>
      <Slider.Track>
        <Slider.Indicator />
        <Slider.Thumb />
      </Slider.Track>
    </Slider.Control>
  </Slider.Root>
</template>
