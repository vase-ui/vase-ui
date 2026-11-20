<script setup lang="ts">
import { shallowRef } from 'vue';
import * as TimeClock from '../../time-clock/parts';
import * as TimeField from '../../time-field/parts';
import * as TimePicker from '../index.parts';

defineOptions({ inheritAttrs: false });

// The attributes go to the root. `popupProps`, `listProps` and `clockProps` go to the part of their
// name. A part is in the popup when its prop is set.
withDefaults(
  defineProps<{
    hasField?: boolean;
    trigger?: boolean;
    popupProps?: Record<string, unknown>;
    list?: boolean;
    listProps?: Record<string, unknown>;
    columns?: boolean;
    minuteStep?: number;
    clock?: boolean;
    clockProps?: Record<string, unknown>;
    keepMounted?: boolean;
  }>(),
  {
    hasField: true,
    trigger: true,
    popupProps: () => ({}),
    listProps: () => ({}),
    minuteStep: 1,
    clockProps: () => ({}),
  },
);

// The parts expose their members. A test reads them through `root` and `field`.
const root = shallowRef<{ close: () => void; unmount: () => void } | null>(null);
const field = shallowRef<{
  element: HTMLElement | null;
  inputElement: HTMLInputElement | null;
  clear: () => void;
} | null>(null);

defineExpose({ root, field });
</script>

<template>
  <TimePicker.Root ref="root" v-bind="$attrs">
    <TimePicker.Field v-if="hasField" ref="field" data-testid="field">
      <TimeField.Input />
    </TimePicker.Field>
    <TimePicker.Trigger v-if="trigger" data-testid="trigger">Open</TimePicker.Trigger>
    <TimePicker.Portal :keep-mounted="keepMounted">
      <TimePicker.Positioner data-testid="positioner">
        <TimePicker.Popup aria-label="Choose time" data-testid="popup" v-bind="popupProps">
          <TimePicker.List v-if="list" v-bind="listProps" data-testid="list" />
          <template v-if="columns">
            <TimePicker.Column unit="hour" data-testid="hour-column" />
            <TimePicker.Column unit="minute" :step="minuteStep" data-testid="minute-column" />
            <TimePicker.Column unit="second" :step="15" data-testid="second-column" />
            <TimePicker.Column unit="dayPeriod" data-testid="day-period-column" />
          </template>
          <TimePicker.Clock v-if="clock" v-bind="clockProps" data-testid="clock">
            <TimeClock.ViewTrigger view="hour" data-testid="hour-trigger" />
            <TimeClock.ViewTrigger view="minute" data-testid="minute-trigger" />
            <TimeClock.DayPeriod value="am" data-testid="am" />
            <TimeClock.DayPeriod value="pm" data-testid="pm" />
            <TimeClock.Face data-testid="face" style="width: 200px; height: 200px">
              <TimeClock.Hand />
              <template #number="{ number }">
                <TimeClock.Number :number="number" />
              </template>
            </TimeClock.Face>
          </TimePicker.Clock>
          <TimePicker.Close>Close</TimePicker.Close>
        </TimePicker.Popup>
      </TimePicker.Positioner>
    </TimePicker.Portal>
  </TimePicker.Root>
</template>
