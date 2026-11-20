<!-- @strictTemplates true -->
<script setup lang="ts">
import { expectType } from '#test-utils';
import { Calendar } from '@vase-ui/vue/calendar';

const date = Temporal.PlainDate.from('2026-11-14');

function onDate(value: Temporal.PlainDate, eventDetails: Calendar.Root.ChangeEventDetails) {
  return value.day + eventDetails.reason.length;
}

function onWrongEventDetails(value: Temporal.PlainDate, eventDetails: string) {
  return value.day + eventDetails.length;
}
</script>

<template>
  <Calendar.Root @value-change="onDate" />
  <Calendar.Root @value-change.once="onDate" />
  <Calendar.Root @update:model-value="(value: Temporal.PlainDate) => value" />
  <Calendar.Root multiple @value-change="(value: Temporal.PlainDate[]) => value" />
  <Calendar.Root @value-change="(value) => expectType<Temporal.PlainDate, typeof value>(value)" />
  <Calendar.Root
    multiple
    @value-change="(value) => expectType<Temporal.PlainDate[], typeof value>(value)"
  />
  <!-- @vue-expect-error `eventDetails` is an object -->
  <Calendar.Root @value-change="onWrongEventDetails" />
  <!-- @vue-expect-error A calendar with no value gives a date, not a text. -->
  <Calendar.Root @value-change="(value: string) => value" />
  <Calendar.Root :min="date" readonly autofocus />
</template>
