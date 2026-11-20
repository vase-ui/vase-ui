<script setup lang="ts">
import { DateField } from '@vase-ui/vue/date-field';
import { Field } from '@vase-ui/vue/field';
import styles from './index.module.css';

const defaultValue = Temporal.PlainDate.from('2026-12-01');
const minDate = Temporal.PlainDate.from('2026-11-01');
const maxDate = Temporal.PlainDate.from('2026-11-30');
// Saturday and Sunday.
const unavailableDates = { dayOfWeek: [6, 7] };
</script>

<template>
  <Field.Root name="checkIn" :class="styles.Field">
    <Field.Label :class="styles.Label">Check-in date</Field.Label>
    <DateField.Root
      locale="en-US"
      required
      :default-value="defaultValue"
      :min="minDate"
      :max="maxDate"
      :unavailable-dates="unavailableDates"
      :class="styles.Root"
    >
      <DateField.Input :class="styles.Input">
        <template #segment="{ segment }">
          <DateField.Segment v-if="segment.editable" :segment="segment" :class="styles.Segment" />
          <DateField.Literal v-else :segment="segment" :class="styles.Literal" />
        </template>
      </DateField.Input>
    </DateField.Root>
    <Field.Description :class="styles.Description">
      Choose a weekday in November 2026.
    </Field.Description>
    <Field.Error :class="styles.Error" />
  </Field.Root>
</template>
