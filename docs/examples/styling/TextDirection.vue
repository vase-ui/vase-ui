<script setup lang="ts">
import { Slider } from '@vase-ui/vue/slider';
</script>

<template>
  <div dir="rtl">
    <Slider.Root dir="rtl" :default-value="25">
      <Slider.Control class="Control">
        <Slider.Track class="Track">
          <Slider.Indicator class="Indicator" />
          <Slider.Thumb aria-label="Volume" class="Thumb" />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  </div>
</template>
