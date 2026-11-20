<!-- @strictTemplates true -->
<script setup lang="ts">
import { Resizable } from '../src/resizable';
import { Slider } from '@vase-ui/vue/slider';

const id = 'id';
</script>

<template>
  <Slider.Root aria-labelledby="id" />
  <Slider.Root :aria-labelledby="id" />
  <!-- @vue-expect-error `aria-labelledby` is a string -->
  <Slider.Root :aria-labelledby="5" />

  <Slider.Thumb aria-label="x" aria-labelledby="id" aria-describedby="id" aria-valuetext="x" />
  <Slider.Thumb
    :aria-label="id"
    :aria-labelledby="id"
    :aria-describedby="id"
    :aria-valuetext="id"
  />
  <!-- @vue-expect-error `aria-label` is a string -->
  <Slider.Thumb :aria-label="5" />
  <!-- @vue-expect-error `aria-labelledby` is a string -->
  <Slider.Thumb :aria-labelledby="5" />
  <!-- @vue-expect-error `aria-describedby` is a string -->
  <Slider.Thumb :aria-describedby="5" />
  <!-- @vue-expect-error `aria-valuetext` is a string -->
  <Slider.Thumb :aria-valuetext="5" />

  <Resizable.Handle aria-valuetext="x" />
  <Resizable.Handle :aria-valuetext="id" />
  <!-- @vue-expect-error `aria-valuetext` is a string -->
  <Resizable.Handle :aria-valuetext="5" />
</template>
