<script setup lang="ts">
import { Slider } from '@vase-ui/vue/slider';
import styles from './index.module.css';

const MIN = 0;
const MAX = 100;
const MARKS = [0, 25, 50, 75, 100];

function valueToPercent(value: number) {
  return ((value - MIN) / (MAX - MIN)) * 100;
}
</script>

<template>
  <Slider.Root :class="styles.Root" :default-value="40" :min="MIN" :max="MAX">
    <Slider.Control :class="styles.Control">
      <Slider.Track :class="styles.Track">
        <Slider.Indicator :class="styles.Indicator" />
        <div
          v-for="mark in MARKS"
          :key="mark"
          aria-hidden="true"
          :class="styles.Mark"
          :style="{ left: `${valueToPercent(mark)}%` }"
        />
        <Slider.Thumb aria-label="Volume" :class="styles.Thumb" />
      </Slider.Track>
    </Slider.Control>
    <div :class="styles.MarkLabels" aria-hidden="true">
      <span
        v-for="mark in MARKS"
        :key="mark"
        :class="styles.MarkLabel"
        :style="{ left: `${valueToPercent(mark)}%` }"
      >
        {{ mark }}
      </span>
    </div>
  </Slider.Root>
</template>
