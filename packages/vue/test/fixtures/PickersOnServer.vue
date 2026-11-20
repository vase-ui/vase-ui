<script setup lang="ts">
import { DateField } from '../../src/date-field';
import { DatePicker } from '../../src/date-picker';
import { DateRangePicker } from '../../src/date-range-picker';
import { Popover } from '../../src/popover';
import { TimeField } from '../../src/time-field';
import { TimePicker } from '../../src/time-picker';
import PickerCalendarGrid from './PickerCalendarGrid.vue';

// A picker of `family` for a server render. The props of a server render go to Node as JSON, so a
// value is a text, and the form of the text gives its kind. A range is two texts with a space.
// `inline` renders the calendar, or the list and the hour column, outside the popup.
const props = defineProps<{
  family: 'date' | 'range' | 'time';
  value?: string | undefined;
  locale?: string | undefined;
  disabled?: boolean | undefined;
  open?: boolean | undefined;
  portalDisabled?: boolean | undefined;
  inline?: boolean | undefined;
  hourCycle?: 12 | 24 | undefined;
}>();

function toValue(text: string | undefined) {
  if (text === undefined) return undefined;
  if (text.includes('[')) return Temporal.ZonedDateTime.from(text);
  if (/^\d{2}:\d{2}/.test(text)) return Temporal.PlainTime.from(text);
  return text.includes('T') ? Temporal.PlainDateTime.from(text) : Temporal.PlainDate.from(text);
}
const value = toValue(props.value?.split(' ')[0]);
const end = toValue(props.value?.split(' ')[1]);
const date = value as Temporal.PlainDate | undefined;
const range = date && ([date, (end as Temporal.PlainDate | undefined) ?? null] as const);
const time = value as Temporal.PlainTime | undefined;
// A template reads only the globals that Vue lists, and `Temporal` is not one of them.
const today = Temporal.PlainDate.from('2026-11-18');
</script>

<template>
  <DatePicker.Root
    v-if="family === 'date'"
    :default-value="date"
    :default-open="open"
    :locale="locale"
    :disabled="disabled"
    name="when"
  >
    <DatePicker.Field><DateField.Input /></DatePicker.Field>
    <DatePicker.Trigger data-testid="trigger" aria-label="Choose date">Open</DatePicker.Trigger>
    <DatePicker.Calendar v-if="inline" :today="today"><PickerCalendarGrid /></DatePicker.Calendar>
    <Popover.Portal :disabled="portalDisabled">
      <DatePicker.Positioner>
        <DatePicker.Popup aria-label="Choose a date">
          <DatePicker.Calendar :today="today"><PickerCalendarGrid /></DatePicker.Calendar>
        </DatePicker.Popup>
      </DatePicker.Positioner>
    </Popover.Portal>
  </DatePicker.Root>
  <DateRangePicker.Root
    v-else-if="family === 'range'"
    :default-value="range"
    :default-open="open"
    :locale="locale"
    :disabled="disabled"
  >
    <DateRangePicker.StartField aria-label="Start"><DateField.Input /></DateRangePicker.StartField>
    <DateRangePicker.EndField aria-label="End"><DateField.Input /></DateRangePicker.EndField>
    <DateRangePicker.Trigger data-testid="trigger" aria-label="Choose dates"
      >Open</DateRangePicker.Trigger
    >
    <DateRangePicker.Calendar v-if="inline" :today="today">
      <PickerCalendarGrid />
    </DateRangePicker.Calendar>
  </DateRangePicker.Root>
  <TimePicker.Root
    v-else
    :default-value="time"
    :default-open="open"
    :locale="locale"
    :hour-cycle="hourCycle"
    :disabled="disabled"
    name="start"
  >
    <TimePicker.Field><TimeField.Input /></TimePicker.Field>
    <TimePicker.Trigger data-testid="trigger" aria-label="Choose time">Open</TimePicker.Trigger>
    <template v-if="inline">
      <TimePicker.List data-testid="list" :step="60" aria-label="Times" />
      <TimePicker.Column data-testid="hour" unit="hour" />
    </template>
    <Popover.Portal :disabled="portalDisabled">
      <TimePicker.Positioner>
        <TimePicker.Popup aria-label="Choose a time">
          <TimePicker.List :step="60" aria-label="Times" />
        </TimePicker.Popup>
      </TimePicker.Positioner>
    </Popover.Portal>
  </TimePicker.Root>
</template>
