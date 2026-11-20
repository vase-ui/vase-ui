<script setup lang="ts">
import { DateField } from '../../src/date-field';
import { LocaleProvider } from '../../src/locale-provider';
import { TimeClock } from '../../src/time-clock';

// A date field and a clock with no `locale` prop, in a provider.
defineProps<{ locale: string }>();

const day = Temporal.PlainDate.from('2026-11-14');
const time = Temporal.PlainTime.from('15:30');
</script>

<template>
  <LocaleProvider :locale="locale">
    <DateField.Root :default-value="day">
      <DateField.Input />
    </DateField.Root>
    <TimeClock.Root :default-value="time">
      <TimeClock.Face />
    </TimeClock.Root>
  </LocaleProvider>
</template>
