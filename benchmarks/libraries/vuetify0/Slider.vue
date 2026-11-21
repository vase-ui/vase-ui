<script setup lang="ts">
import { Slider } from '@vuetify/v0';
import { ref } from 'vue';

const value = ref<number | number[]>([50]);
</script>

<template>
  <Slider.Root v-model="value">
    <Slider.Track>
      <Slider.Range />
    </Slider.Track>
    <Slider.Thumb />
  </Slider.Root>
</template>
