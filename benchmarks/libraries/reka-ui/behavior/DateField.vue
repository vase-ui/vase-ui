<script setup lang="ts">
import {
  CalendarDate,
  CalendarDateTime,
  ZonedDateTime,
  type DateValue,
} from '@internationalized/date';
import { DateFieldInput, DateFieldRoot, Label } from 'reka-ui';
import { computed, shallowRef } from 'vue';
import '../../../behavior/style.css';

const value = shallowRef<DateValue | null>(new CalendarDate(2026, 1, 15));
// The build removes the names of classes, so the name comes from the class that matches.
const types = { CalendarDate, CalendarDateTime, ZonedDateTime };
const valueType = computed(() => {
  const [name] = Object.entries(types).find(([, type]) => value.value instanceof type) ?? [];
  return name ? `${name} (@internationalized/date)` : String(value.value);
});
</script>

<template>
  <form class="bench-page">
    <Label for="date">Date</Label>
    <DateFieldRoot
      id="date"
      v-slot="{ segments }"
      :model-value="value"
      @update:model-value="value = $event ?? null"
      data-bench="date-field"
      name="date"
      locale="en-US"
    >
      <template v-for="item in segments" :key="item.part">
        <DateFieldInput v-if="item.part === 'literal'" :part="item.part">
          {{ item.value }}
        </DateFieldInput>
        <DateFieldInput v-else :part="item.part">{{ item.value }}</DateFieldInput>
      </template>
    </DateFieldRoot>
    <output data-bench="value">{{ String(value) }}</output>
    <output data-bench="value-type">{{ valueType }}</output>
  </form>
</template>
