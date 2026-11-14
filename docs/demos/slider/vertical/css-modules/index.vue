<script setup lang="ts">
import { Slider } from '@vase-ui/vue/slider';
import styles from './index.module.css';
</script>

<template>
  <Slider.Root orientation="vertical" :default-value="35">
    <Slider.Control :class="styles.Control">
      <Slider.Track :class="styles.Track">
        <Slider.Indicator :class="styles.Indicator" />
        <Slider.Thumb aria-label="Volume" :class="styles.Thumb" />
      </Slider.Track>
    </Slider.Control>
  </Slider.Root>
</template>
