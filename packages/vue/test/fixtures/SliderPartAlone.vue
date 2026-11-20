<script setup lang="ts">
import { Slider } from '../../src/slider';

defineProps<{ part: keyof typeof Slider }>();
</script>

<template>
  <component :is="Slider[part]" />
</template>
