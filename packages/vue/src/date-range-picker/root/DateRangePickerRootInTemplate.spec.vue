<!-- @strictTemplates true -->
<script setup lang="ts">
import { shallowRef } from 'vue';
import { expectType } from '#test-utils';
import { DateRangePicker } from '@vase-ui/vue/date-range-picker';

const days = shallowRef<DateRangePicker.Root.Value<Temporal.PlainDate>>([null, null]);
const zoned = shallowRef<DateRangePicker.Root.Value<Temporal.ZonedDateTime>>([null, null]);
const optional = shallowRef<DateRangePicker.Root.Value<Temporal.PlainDate> | null>(null);
const open = shallowRef(false);

function onDaysChange(
  value: DateRangePicker.Root.Value<Temporal.PlainDate>,
  details: DateRangePicker.Root.ChangeEventDetails,
) {
  return String(value) + details.reason;
}

function onWrongKind(value: [Temporal.PlainTime | null, Temporal.PlainTime | null]) {
  return String(value);
}
</script>

<template>
  <!-- `v-model:value` gives back the kind of the ends that the parent gave. -->
  <DateRangePicker.Root v-model:value="days" v-model:open="open" />
  <DateRangePicker.Root v-model:value="zoned" />
  <DateRangePicker.Root v-model:value="optional" />
  <!-- @vue-expect-error a zoned end does not fit a ref of dates -->
  <DateRangePicker.Root
    v-model:value="days"
    :default-value="[Temporal.ZonedDateTime.from('2026-11-14T15:04[UTC]'), null]"
  />

  <DateRangePicker.Root
    :value="days"
    @value-change="
      (value) => {
        expectType<[Temporal.PlainDate | null, Temporal.PlainDate | null], typeof value>(value);
      }
    "
  />
  <DateRangePicker.Root :value="days" @value-change="onDaysChange" />
  <!-- @vue-expect-error the picker gives dates, and a time does not fit them -->
  <DateRangePicker.Root :value="days" @value-change="onWrongKind" />

  <!-- Each part has the props of the part that it renders, less the props of the root. -->
  <DateRangePicker.Root>
    <DateRangePicker.StartField id="from" />
    <DateRangePicker.EndField id="to" />
    <DateRangePicker.Trigger />
    <DateRangePicker.Positioner />
    <DateRangePicker.Calendar :number-of-months="2" :min-days="2" />
    <!-- @vue-expect-error the root owns the limits -->
    <DateRangePicker.Calendar :min-date="Temporal.PlainDate.from('2026-11-14')" />
    <!-- @vue-expect-error the root owns the name of the form entry -->
    <DateRangePicker.StartField name="from" />
    <!-- @vue-expect-error the root owns the name of the form entry -->
    <DateRangePicker.EndField name="to" />
  </DateRangePicker.Root>
</template>
