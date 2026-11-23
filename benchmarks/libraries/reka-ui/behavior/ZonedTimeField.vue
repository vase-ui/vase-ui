<script setup lang="ts">
import { parseZonedDateTime, ZonedDateTime } from '@internationalized/date';
import { Label, TimeFieldInput, TimeFieldRoot, type TimeValue } from 'reka-ui';
import { computed, shallowRef } from 'vue';
import '../../../behavior/style.css';

const value = shallowRef<TimeValue | null>(
  parseZonedDateTime('2026-03-08T01:30[America/New_York]'),
);
const instant = computed(() =>
  value.value instanceof ZonedDateTime ? value.value.toDate().getTime() : undefined,
);
</script>

<template>
  <div class="bench-page">
    <Label for="time">Time</Label>
    <TimeFieldRoot
      id="time"
      v-slot="{ segments }"
      :model-value="value"
      @update:model-value="value = $event ?? null"
      data-bench="time-field"
      :hour-cycle="24"
      locale="en-US"
    >
      <template v-for="item in segments" :key="item.part">
        <TimeFieldInput v-if="item.part === 'literal'" :part="item.part">
          {{ item.value }}
        </TimeFieldInput>
        <TimeFieldInput v-else :part="item.part">{{ item.value }}</TimeFieldInput>
      </template>
    </TimeFieldRoot>
    <output data-bench="instant">{{ instant }}</output>
  </div>
</template>
