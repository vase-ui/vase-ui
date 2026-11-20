<script setup lang="ts">
import { shallowRef } from 'vue';
import { TimeField } from '@vase-ui/vue/time-field';
import { TimePicker } from '@vase-ui/vue/time-picker';
import { Popover } from '@vase-ui/vue/popover';

const time = shallowRef<Temporal.PlainTime | null>(Temporal.PlainTime.from('15:00'));
</script>

<template>
  <main>
    <form data-testid="form" @submit.prevent>
      <TimePicker.Root v-model="time" name="start" locale="en-US" :hour-cycle="12">
        <TimePicker.Field data-testid="start">
          <TimeField.Input>
            <template #segment="{ segment }">
              <TimeField.Segment
                v-if="segment.editable"
                :segment="segment"
                :data-testid="`start-${segment.type}`"
              />
              <TimeField.Literal v-else :segment="segment" />
            </template>
          </TimeField.Input>
        </TimePicker.Field>
        <TimePicker.Trigger data-testid="start-trigger" aria-label="Choose time"
          >Open</TimePicker.Trigger
        >
        <Popover.Portal>
          <TimePicker.Positioner>
            <TimePicker.Popup aria-label="Choose time" data-testid="start-popup">
              <TimePicker.List :step="60" aria-label="Times" data-testid="start-list" />
            </TimePicker.Popup>
          </TimePicker.Positioner>
        </Popover.Portal>
      </TimePicker.Root>
    </form>
    <output data-testid="start-value">{{ time?.toString() ?? '' }}</output>
  </main>
</template>
