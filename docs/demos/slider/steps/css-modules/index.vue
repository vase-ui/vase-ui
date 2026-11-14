<script setup lang="ts">
import { Slider } from '@vase-ui/vue/slider';
import styles from './index.module.css';
</script>

<template>
  <Slider.Root
    :class="styles.Root"
    :default-value="400"
    :min="100"
    :max="900"
    :step="100"
    :large-step="200"
  >
    <Slider.Label :class="styles.Label">Font weight</Slider.Label>
    <Slider.Value :class="styles.Value" />
    <Slider.Control :class="styles.Control">
      <Slider.Track :class="styles.Track">
        <Slider.Indicator :class="styles.Indicator" />
        <Slider.Thumb :class="styles.Thumb" />
      </Slider.Track>
    </Slider.Control>
  </Slider.Root>
</template>
