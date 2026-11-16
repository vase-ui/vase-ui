<script setup lang="ts">
import { TimeClock } from '@vase-ui/vue/time-clock';
import { TimeField } from '@vase-ui/vue/time-field';
import { TimePicker } from '@vase-ui/vue/time-picker';
</script>

<template>
  <TimePicker.Root>
    <TimePicker.Field>
      <TimeField.Input />
    </TimePicker.Field>
    <TimePicker.Trigger />
    <TimePicker.Portal>
      <TimePicker.Positioner>
        <TimePicker.Popup>
          <TimePicker.List>
            <template #item="{ time }">
              <TimePicker.Item :time="time" />
            </template>
          </TimePicker.List>
          <TimePicker.Column unit="hour">
            <template #item="{ value }">
              <TimePicker.ColumnItem :value="value" />
            </template>
          </TimePicker.Column>
          <TimePicker.Clock>
            <TimeClock.ViewTrigger view="hour" />
            <TimeClock.ViewTrigger view="minute" />
            <TimeClock.DayPeriod value="am" />
            <TimeClock.DayPeriod value="pm" />
            <TimeClock.Face>
              <TimeClock.Hand />
              <template #number="{ number }">
                <TimeClock.Number :number="number" />
              </template>
            </TimeClock.Face>
          </TimePicker.Clock>
          <TimePicker.Close />
        </TimePicker.Popup>
      </TimePicker.Positioner>
    </TimePicker.Portal>
  </TimePicker.Root>
</template>
