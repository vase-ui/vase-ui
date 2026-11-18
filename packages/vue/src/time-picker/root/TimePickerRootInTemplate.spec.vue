<!-- @strictTemplates true -->
<script setup lang="ts">
import { shallowRef } from 'vue';
import { expectType } from '#test-utils';
import type { TimeClock, TimeClockView } from '@vase-ui/vue/time-clock';
import { TimePicker } from '@vase-ui/vue/time-picker';

const time = shallowRef<Temporal.PlainTime | null>(null);
const zoned = shallowRef<Temporal.ZonedDateTime | null>(null);
const open = shallowRef(false);
const clockView = shallowRef<TimeClockView>('hour');
// A template reads only the globals that Vue lists, and `Temporal` is not one of them.
const nine = Temporal.PlainTime.from('09:00');
const zonedTime = Temporal.ZonedDateTime.from('2026-11-14T15:04[UTC]');

function onTimeChange(
  value: Temporal.PlainTime | null,
  details: TimePicker.Root.ChangeEventDetails,
) {
  return String(value) + details.reason;
}

function onWrongKind(value: Temporal.PlainDate | null) {
  return String(value);
}
</script>

<template>
  <!-- `v-model` gives back the kind of the value that the parent gave. -->
  <TimePicker.Root v-model="time" v-model:open="open" />
  <TimePicker.Root v-model="zoned" />
  <!-- @vue-expect-error a zoned value does not fit a ref of a time -->
  <TimePicker.Root v-model="time" :default-value="zonedTime" />

  <TimePicker.Root
    :model-value="time"
    @value-change="
      (value) => {
        expectType<Temporal.PlainTime | null, typeof value>(value);
      }
    "
  />
  <TimePicker.Root :model-value="time" @value-change="onTimeChange" />
  <!-- @vue-expect-error the picker gives a time, and a date does not fit it -->
  <TimePicker.Root :model-value="time" @value-change="onWrongKind" />

  <!-- Each part has the props of the part that it renders, less the props of the root. -->
  <TimePicker.Root>
    <TimePicker.Field id="when" :step="60" />
    <TimePicker.Trigger />
    <TimePicker.Positioner />
    <TimePicker.List :step="15" />
    <TimePicker.Item :time="nine" />
    <TimePicker.Column unit="minute" :step="5" />
    <TimePicker.ColumnItem :value="5" />
    <TimePicker.ColumnItem value="am" />
    <TimePicker.Clock :minute-step="5" default-view="minute" />
    <!-- The clock gives the events of `TimeClock.Root` that are not about the value. -->
    <TimePicker.Clock
      v-model:view="clockView"
      @view-change="
        (next, details) => {
          expectType<TimeClockView, typeof next>(next);
          expectType<TimeClock.Root.ViewChangeEventDetails, typeof details>(details);
        }
      "
      @value-committed="
        (value, details) => {
          expectType<
            Temporal.PlainTime | Temporal.PlainDateTime | Temporal.ZonedDateTime,
            typeof value
          >(value);
          expectType<TimeClock.Root.CommitEventDetails, typeof details>(details);
        }
      "
    />
    <!-- @vue-expect-error the root owns the limits -->
    <TimePicker.Clock :min-time="nine" />
    <!-- @vue-expect-error the root owns the name of the form entry -->
    <TimePicker.Field name="when" />
    <!-- @vue-expect-error a column has no `year` unit -->
    <TimePicker.Column unit="year" />
  </TimePicker.Root>
</template>
