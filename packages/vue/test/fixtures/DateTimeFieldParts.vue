<script setup lang="ts">
import type { PropType } from 'vue';
import { DateField } from '../../src/date-field';
import { TimeField } from '../../src/time-field';

// The attributes of each part of a date field or of a time field.
defineProps({
  family: { type: String as PropType<'date' | 'time'>, required: true },
  root: Object as PropType<Record<string, unknown>>,
  input: Object as PropType<Record<string, unknown>>,
  literal: Object as PropType<Record<string, unknown>>,
  clear: Object as PropType<Record<string, unknown>>,
});
</script>

<template>
  <DateField.Root v-if="family === 'date'" v-bind="root">
    <DateField.Input v-bind="input">
      <template #segment="{ segment }">
        <DateField.Segment v-if="segment.editable" :segment="segment" />
        <DateField.Literal v-else v-bind="literal" :segment="segment" />
      </template>
    </DateField.Input>
    <DateField.Clear v-bind="clear" aria-label="Clear">×</DateField.Clear>
  </DateField.Root>
  <TimeField.Root v-else v-bind="root">
    <TimeField.Input v-bind="input">
      <template #segment="{ segment }">
        <TimeField.Segment v-if="segment.editable" :segment="segment" />
        <TimeField.Literal v-else v-bind="literal" :segment="segment" />
      </template>
    </TimeField.Input>
    <TimeField.Clear v-bind="clear" aria-label="Clear">×</TimeField.Clear>
  </TimeField.Root>
</template>
