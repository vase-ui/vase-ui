<script setup lang="ts">
import { Meter } from '../index';

defineProps<{
  value: number;
  labelId?: string | undefined;
  ariaLabel?: string | undefined;
}>();
</script>

<template>
  <Meter.Root :value="value" :aria-label="ariaLabel">
    <Meter.Label :id="labelId">Battery Level</Meter.Label>
    <Meter.Value />
    <Meter.Track>
      <Meter.Indicator />
    </Meter.Track>
  </Meter.Root>
</template>
