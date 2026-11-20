<script setup lang="ts">
import { TimeClock } from '@vase-ui/vue/time-clock';
import { TimeField } from '@vase-ui/vue/time-field';
import { TimePicker } from '@vase-ui/vue/time-picker';
import { Popover } from '@vase-ui/vue/popover';
</script>

<template>
  <TimePicker.Root>
    <TimePicker.Field>
      <TimeField.Input />
    </TimePicker.Field>
    <TimePicker.Trigger aria-label="Choose time" />
    <Popover.Portal>
      <TimePicker.Positioner>
        <TimePicker.Popup aria-label="Choose a time">
          <TimePicker.List aria-label="Times">
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
          <Popover.Close />
        </TimePicker.Popup>
      </TimePicker.Positioner>
    </Popover.Portal>
  </TimePicker.Root>
</template>
