<script setup lang="ts">
import * as TimeClock from '../../time-clock/index.parts';
import * as TimeField from '../../time-field/index.parts';
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
    // The list, the columns and the clock follow the hour cycle, which an engine can resolve in
    // another way than Node.
    parts?: boolean | undefined;
  }>(),
  { parts: true },
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
    <TimePicker.Field data-testid="field">
      <TimeField.Input />
    </TimePicker.Field>
    <TimePicker.Trigger data-testid="trigger">Open</TimePicker.Trigger>
    <template v-if="props.parts">
      <TimePicker.List :step="60" data-testid="list" />
      <TimePicker.Column unit="hour" data-testid="hour-column" />
      <TimePicker.Column unit="minute" :step="15" data-testid="minute-column" />
      <TimePicker.Column unit="dayPeriod" data-testid="period-column" />
      <TimePicker.Clock data-testid="clock">
        <TimeClock.Face data-testid="face">
          <TimeClock.Hand />
          <template #number="{ number }">
            <TimeClock.Number :number="number" />
          </template>
        </TimeClock.Face>
      </TimePicker.Clock>
    </template>
  </TimePicker.Root>
</template>
