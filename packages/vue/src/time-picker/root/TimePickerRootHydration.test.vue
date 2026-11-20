<script setup lang="ts">
import * as TimeClock from '../../time-clock/parts';
import * as TimeField from '../../time-field/parts';
import * as TimePicker from '../index.parts';

// The props of a server render go to Node as JSON, so a value is a text. The form of the text gives
// the kind of the value. The list, the column and the clock are not in the popup, because a server
// renders no popup.
const props = withDefaults(
  defineProps<{
    value?: string | undefined;
    locale?: string | undefined;
    hourCycle?: 12 | 24 | undefined;
    name?: string | undefined;
    disabled?: boolean | undefined;
    readOnly?: boolean | undefined;
    minTime?: string | undefined;
    // A field, a list, a column and a clock follow the hour cycle and the digits of the locale,
    // which an engine can resolve in another way than Node. A case that hydrates such a layout
    // leaves some of them out.
    field?: boolean | undefined;
    list?: boolean | undefined;
    columns?: boolean | undefined;
    clock?: boolean | undefined;
  }>(),
  { field: true, list: true, columns: true, clock: true },
);

function toValue(text: string | undefined) {
  if (text === undefined) {
    return undefined;
  }
  if (text.includes('[')) {
    return Temporal.ZonedDateTime.from(text);
  }
  return text.includes('T') ? Temporal.PlainDateTime.from(text) : Temporal.PlainTime.from(text);
}

// A template reads only the globals that Vue lists, and `Temporal` is not one of them.
const minTime = props.minTime === undefined ? undefined : Temporal.PlainTime.from(props.minTime);
</script>

<template>
  <TimePicker.Root
    :default-value="toValue(props.value)"
    :locale="props.locale"
    :hour-cycle="props.hourCycle"
    :name="props.name"
    :disabled="props.disabled"
    :read-only="props.readOnly"
    :min-time="minTime"
  >
    <TimePicker.Field v-if="props.field" data-testid="field">
      <TimeField.Input />
    </TimePicker.Field>
    <TimePicker.Trigger data-testid="trigger">Open</TimePicker.Trigger>
    <TimePicker.List v-if="props.list" :step="60" data-testid="list" />
    <template v-if="props.columns">
      <TimePicker.Column unit="hour" data-testid="hour-column" />
      <TimePicker.Column unit="minute" :step="15" data-testid="minute-column" />
      <TimePicker.Column unit="dayPeriod" data-testid="period-column" />
    </template>
    <TimePicker.Clock v-if="props.clock" data-testid="clock">
      <TimeClock.Face data-testid="face">
        <TimeClock.Hand />
        <template #number="{ number }">
          <TimeClock.Number :number="number" />
        </template>
      </TimeClock.Face>
    </TimePicker.Clock>
  </TimePicker.Root>
</template>
