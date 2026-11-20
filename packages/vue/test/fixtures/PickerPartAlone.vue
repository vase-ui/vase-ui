<script setup lang="ts">
import type { PropType } from 'vue';
import { DatePicker } from '../../src/date-picker';
import { DateRangePicker } from '../../src/date-range-picker';
import { TimePicker } from '../../src/time-picker';

// A part of a picker with no root.
const props = defineProps({
  family: {
    type: String as PropType<'DatePicker' | 'DateRangePicker' | 'TimePicker'>,
    required: true,
  },
  part: { type: String, required: true },
});
const families = { DatePicker, DateRangePicker, TimePicker } as Record<
  string,
  Record<string, unknown>
>;
const part = families[props.family]![props.part];
</script>

<template>
  <component :is="part" />
</template>
