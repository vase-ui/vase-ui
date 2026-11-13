<script setup lang="ts">
import { Slider } from '@vase-ui/vue/slider';

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
