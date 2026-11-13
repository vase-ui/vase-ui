<script setup lang="ts">
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import { Slider } from '@vase-ui/vue/slider';
import styles from './index.module.css';
</script>

<template>
  <div dir="rtl">
    <DirectionProvider direction="rtl">
      <Slider.Root :default-value="25">
        <Slider.Control :class="styles.Control">
          <Slider.Track :class="styles.Track">
            <Slider.Indicator :class="styles.Indicator" />
            <Slider.Thumb ariaLabel="Volume" :class="styles.Thumb" />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
    </DirectionProvider>
  </div>
</template>
