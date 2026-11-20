<!-- @strictTemplates true -->
<script setup lang="ts">
import { expectType } from '#test-utils';
import { RangeCalendar } from '@vase-ui/vue/range-calendar';

function onRange(
  value: [Temporal.PlainDate | null, Temporal.PlainDate | null],
  eventDetails: RangeCalendar.Root.ChangeEventDetails,
) {
  return value.length + eventDetails.reason.length;
}

function onWrongEventDetails(
  value: [Temporal.PlainDate | null, Temporal.PlainDate | null],
  eventDetails: string,
) {
  return value.length + eventDetails.length;
}
</script>

<template>
  <RangeCalendar.Root @value-change="onRange" />
  <RangeCalendar.Root @value-change.once="onRange" />
  <RangeCalendar.Root
    @update:model-value="(value: [Temporal.PlainDate | null, Temporal.PlainDate | null]) => value"
  />
  <RangeCalendar.Root
    @value-change="
      (value) =>
        expectType<[Temporal.PlainDate | null, Temporal.PlainDate | null], typeof value>(value)
    "
  />
  <!-- @vue-expect-error `eventDetails` is an object -->
  <RangeCalendar.Root @value-change="onWrongEventDetails" />
  <!-- @vue-expect-error A range with no value gives dates, not texts. -->
  <RangeCalendar.Root @value-change="(value: [string, string]) => value" />
</template>
