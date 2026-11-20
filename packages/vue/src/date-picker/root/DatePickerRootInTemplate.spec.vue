<!-- @strictTemplates true -->
<script setup lang="ts">
import { shallowRef } from 'vue';
import { expectType } from '#test-utils';
import type { Calendar } from '@vase-ui/vue/calendar';
import { DatePicker } from '@vase-ui/vue/date-picker';

const day = shallowRef<Temporal.PlainDate | null>(null);
const zoned = shallowRef<Temporal.ZonedDateTime | null>(null);
const open = shallowRef(false);
const month = shallowRef(Temporal.PlainYearMonth.from('2026-11'));
const view = shallowRef<'day' | 'month' | 'year'>('day');
const focusedDate = shallowRef(Temporal.PlainDate.from('2026-11-14'));

function onDayChange(
  value: Temporal.PlainDate | null,
  details: DatePicker.Root.ChangeEventDetails,
) {
  return String(value) + details.reason;
}

function onWrongKind(value: Temporal.PlainTime | null) {
  return String(value);
}
</script>

<template>
  <!-- `v-model` gives back the kind of the value that the parent gave. -->
  <DatePicker.Root v-model="day" v-model:open="open" />
  <DatePicker.Root v-model="zoned" />
  <!-- @vue-expect-error a zoned value does not fit a ref of a date -->
  <DatePicker.Root
    v-model="day"
    :default-value="Temporal.ZonedDateTime.from('2026-11-14T15:04[UTC]')"
  />

  <DatePicker.Root
    :model-value="day"
    @value-change="
      (value) => {
        expectType<Temporal.PlainDate | null, typeof value>(value);
      }
    "
  />
  <DatePicker.Root :model-value="day" @value-change="onDayChange" />
  <!-- @vue-expect-error the picker gives a date, and a time does not fit it -->
  <DatePicker.Root :model-value="day" @value-change="onWrongKind" />

  <!-- Each part has the props of the part that it renders, less the props of the root. -->
  <DatePicker.Root>
    <DatePicker.Field id="when" />
    <DatePicker.Trigger />
    <DatePicker.Positioner />
    <DatePicker.Calendar :number-of-months="2" />
    <DatePicker.TimeField :step="60" />
    <!-- @vue-expect-error the root owns the limits -->
    <DatePicker.Calendar :min="Temporal.PlainDate.from('2026-11-14')" />
    <!-- @vue-expect-error the root owns the name of the form entry -->
    <DatePicker.Field name="when" />
    <!-- The calendar gives the events of `Calendar.Root` that are not about the value. -->
    <DatePicker.Calendar
      v-model:month="month"
      v-model:view="view"
      v-model:focused-date="focusedDate"
      @month-change="
        (next, details) => {
          expectType<Temporal.PlainYearMonth, typeof next>(next);
          expectType<Calendar.Root.ChangeEventDetails, typeof details>(details);
        }
      "
    />
  </DatePicker.Root>
</template>
