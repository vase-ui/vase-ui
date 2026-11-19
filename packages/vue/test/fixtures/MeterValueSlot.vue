<script setup lang="ts">
import type { PropType } from 'vue';
import { Meter } from '../../src/meter';

defineProps({ root: Object as PropType<Record<string, unknown>> });
</script>

<template>
  <Meter.Root :value="30" v-bind="root">
    <Meter.Value v-slot="{ formattedValue, value }"
      >{{ formattedValue }} of {{ value }}</Meter.Value
    >
  </Meter.Root>
</template>
