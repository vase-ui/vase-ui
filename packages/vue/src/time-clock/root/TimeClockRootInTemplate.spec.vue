<!-- @strictTemplates true -->
<script setup lang="ts">
import { expectType } from '#test-utils';
import { TimeClock } from '@vase-ui/vue/time-clock';
import type { TimeClockView } from '@vase-ui/vue/time-clock';

const plainTime = Temporal.PlainTime.from('10:30');
const zoned = Temporal.ZonedDateTime.from('2026-11-14T10:30[Europe/Paris]');

function onTimeChange(value: Temporal.PlainTime, eventDetails: TimeClock.Root.ChangeEventDetails) {
  return value.hour + eventDetails.reason.length;
}

function onTimeCommitted(
  value: Temporal.PlainTime,
  eventDetails: TimeClock.Root.CommitEventDetails,
) {
  return value.hour + eventDetails.reason.length;
}
</script>

<template>
  <TimeClock.Root @value-change="onTimeChange" />
  <TimeClock.Root @value-change.once="onTimeChange" />
  <TimeClock.Root @value-committed="onTimeCommitted" />
  <TimeClock.Root @update:model-value="(value: Temporal.PlainTime) => value" />
  <TimeClock.Root @value-change="(value) => expectType<Temporal.PlainTime, typeof value>(value)" />
  <TimeClock.Root :default-value="plainTime" @value-change="onTimeChange" />
  <TimeClock.Root :default-value="zoned" @value-change="(value: Temporal.ZonedDateTime) => value" />
  <TimeClock.Root
    :reference-date="zoned"
    @update:model-value="(value: Temporal.ZonedDateTime) => value"
  />
  <TimeClock.Root @view-change="(view: TimeClockView) => view" />
  <!-- @vue-expect-error With no `value`, `default-value` and `reference-date`, the value is a plain time. -->
  <TimeClock.Root @value-change="(value: Temporal.ZonedDateTime) => value" />
  <!-- @vue-expect-error `granularity` is an hour, a minute or a second. -->
  <TimeClock.Root granularity="day" />
</template>
