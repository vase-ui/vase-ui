<script setup lang="ts">
import { Progress } from '../index';

defineProps<{
  value: number | null;
  labelId?: string | undefined;
}>();
</script>

<template>
  <Progress.Root :value="value">
    <Progress.Label :id="labelId">Upload progress</Progress.Label>
    <Progress.Value />
    <Progress.Track>
      <Progress.Indicator />
    </Progress.Track>
  </Progress.Root>
</template>
