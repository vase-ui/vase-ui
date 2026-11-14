<script setup lang="ts">
import { Slider } from '@vase-ui/vue/slider';

function onVolumeChange(value: number) {
  console.log(value);
}

function onRangeChange(value: number[]) {
  console.log(value[0], value[1]);
}
</script>

<template>
  <Slider.Root :default-value="50" @value-change="onVolumeChange">
    <Slider.Control>
      <Slider.Track>
        <Slider.Thumb aria-label="Volume" />
      </Slider.Track>
    </Slider.Control>
  </Slider.Root>

  <Slider.Root :default-value="[25, 75]" @value-change="onRangeChange">
    <Slider.Control>
      <Slider.Track>
        <Slider.Thumb :index="0" aria-label="Minimum" />
        <Slider.Thumb :index="1" aria-label="Maximum" />
      </Slider.Track>
    </Slider.Control>
  </Slider.Root>
</template>
