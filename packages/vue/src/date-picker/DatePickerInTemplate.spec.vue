<!-- @strictTemplates true -->
<script setup lang="ts">
import { expectType } from '#test-utils';
import { DatePicker } from '@vase-ui/vue/date-picker';
import { DateRangePicker } from '@vase-ui/vue/date-range-picker';
import { TimePicker } from '@vase-ui/vue/time-picker';

const date = Temporal.PlainDate.from('2026-11-14');
const zoned = Temporal.ZonedDateTime.from('2026-11-14T09:30[Asia/Tokyo]');
const time = Temporal.PlainTime.from('09:30');
</script>

<template>
  <DatePicker.Root
    :model-value="zoned"
    @value-change="(value, details) => {
      expectType<Temporal.ZonedDateTime | null, typeof value>(value);
      expectType<DatePicker.Root.ChangeEventDetails, typeof details>(details);
    }"
    @open-change="(open, details) => expectType<DatePicker.Root.OpenChangeEventDetails, typeof details>(details)"
  />
  <DateRangePicker.Root
    :default-value="[date, null]"
    @value-change="(value) => expectType<DateRangePicker.Root.Value<Temporal.PlainDate>, typeof value>(value)"
  />
  <TimePicker.Root
    :default-value="time"
    @value-change="(value) => expectType<Temporal.PlainTime | null, typeof value>(value)"
  />

  <!-- @vue-expect-error The root owns the limits of the calendar. -->
  <DatePicker.Calendar :min="date" />
  <!-- @vue-expect-error The root owns the value of the field. -->
  <DatePicker.Field :model-value="date" />
  <!-- @vue-expect-error The root owns the value of the clock. -->
  <TimePicker.Clock :model-value="time" />
  <DatePicker.Calendar :number-of-months="2" @month-change="(month) => expectType<Temporal.PlainYearMonth, typeof month>(month)" />
  <TimePicker.Clock :minute-step="5" @value-committed="(value) => value" />

  <DatePicker.Trigger v-slot="{ text }">{{ expectType<string | undefined, typeof text>(text) }}</DatePicker.Trigger>
  <DateRangePicker.Trigger v-slot="{ text }">{{ expectType<string | undefined, typeof text>(text) }}</DateRangePicker.Trigger>
  <TimePicker.Item :time="time" v-slot="{ text }">{{ expectType<string, typeof text>(text) }}</TimePicker.Item>
</template>
