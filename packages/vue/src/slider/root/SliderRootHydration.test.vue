<script setup lang="ts">
import * as Slider from '../index.parts';

defineProps<{
  id?: string | undefined;
  defaultValue: number;
}>();
</script>

<template>
  <Slider.Root :id="id" :default-value="defaultValue">
    <Slider.Control />
  </Slider.Root>
</template>
