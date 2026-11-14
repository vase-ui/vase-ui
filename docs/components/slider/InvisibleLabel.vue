<script setup lang="ts">
import { Slider } from '@vase-ui/vue/slider';
</script>

<template>
  <Slider.Root>
    <Slider.Control>
      <Slider.Track>
        <Slider.Indicator />
        <Slider.Thumb aria-label="Volume" />
      </Slider.Track>
    </Slider.Control>
  </Slider.Root>
</template>
