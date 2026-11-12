<script setup lang="ts">
import { Meter } from '@vase-ui/vue/meter';
</script>

<template>
  <Meter.Root :value="0">
    <Meter.Label />
    <Meter.Track>
      <Meter.Indicator />
    </Meter.Track>
    <Meter.Value />
  </Meter.Root>
</template>
