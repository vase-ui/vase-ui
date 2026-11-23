<script setup lang="ts">
import { DateInput } from '@ark-ui/vue/date-input';
import {
  CalendarDate,
  CalendarDateTime,
  parseDate,
  ZonedDateTime,
  type DateValue,
} from '@internationalized/date';
import { computed, type Ref, ref } from 'vue';
import '../../../behavior/style.css';

const value = ref([parseDate('2026-01-15')]) as Ref<DateValue[]>;
// The build removes the names of classes, so the name comes from the class that matches.
const types = { CalendarDate, CalendarDateTime, ZonedDateTime };
const valueType = computed(() => {
  const items = value.value.map((item) => {
    const [name] = Object.entries(types).find(([, type]) => item instanceof type) ?? [];
    return name ? `${name} (@internationalized/date)` : String(item);
  });
  return `Array of ${[...new Set(items)].join(', ')}`;
});
</script>

<template>
  <form class="bench-page">
    <DateInput.Root v-model="value" data-bench="date-field" name="date" locale="en-US">
      <DateInput.Label>Date</DateInput.Label>
      <DateInput.Control>
        <DateInput.SegmentGroup>
          <DateInput.SegmentContext v-slot="segment">
            <DateInput.Segment :segment="segment" />
          </DateInput.SegmentContext>
        </DateInput.SegmentGroup>
      </DateInput.Control>
      <DateInput.HiddenInput />
    </DateInput.Root>
    <output data-bench="value">{{ String(value) }}</output>
    <output data-bench="value-type">{{ valueType }}</output>
  </form>
</template>
