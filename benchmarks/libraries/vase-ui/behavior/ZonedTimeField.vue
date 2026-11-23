<script setup lang="ts">
import 'temporal-polyfill/global';
import { TimeField } from '@vase-ui/vue/time-field';
import { shallowRef, useId } from 'vue';
import '../../../behavior/style.css';

const id = useId();
const value = shallowRef<Temporal.ZonedDateTime | null>(
  Temporal.ZonedDateTime.from('2026-03-08T01:30[America/New_York]'),
);
</script>

<template>
  <div class="bench-page">
    <label :for="id">Time</label>
    <TimeField.Root
      :id="id"
      v-model="value"
      data-bench="time-field"
      :hour-cycle="24"
      locale="en-US"
    >
      <TimeField.Input>
        <template #segment="{ segment }">
          <TimeField.Segment v-if="segment.editable" :segment="segment" />
          <TimeField.Literal v-else :segment="segment" />
        </template>
      </TimeField.Input>
    </TimeField.Root>
    <output data-bench="instant">{{ value?.epochMilliseconds }}</output>
  </div>
</template>
