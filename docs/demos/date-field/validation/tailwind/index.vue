<script setup lang="ts">
import { DateField } from '@vase-ui/vue/date-field';
import { Field } from '@vase-ui/vue/field';

const defaultValue = Temporal.PlainDate.from('2026-12-01');
const minDate = Temporal.PlainDate.from('2026-11-01');
const maxDate = Temporal.PlainDate.from('2026-11-30');
// Saturday and Sunday.
const unavailableDates = { dayOfWeek: [6, 7] };
</script>

<template>
  <Field.Root name="checkIn" class="flex flex-col items-start gap-1">
    <Field.Label class="text-sm font-bold text-neutral-950 dark:text-white"
      >Check-in date</Field.Label
    >
    <DateField.Root
      locale="en-US"
      required
      :default-value="defaultValue"
      :min="minDate"
      :max="maxDate"
      :unavailable-dates="unavailableDates"
      class="flex items-center"
    >
      <DateField.Input
        class="flex h-8 items-center border border-neutral-950 bg-white px-2 text-sm font-normal text-neutral-950 tabular-nums any-pointer-coarse:text-base focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:text-white dark:focus-within:outline-white"
      >
        <template #segment="{ segment }">
          <DateField.Segment
            v-if="segment.editable"
            :segment="segment"
            class="field-sizing-content px-0.5 text-center caret-transparent outline-0 placeholder:text-neutral-500 focus:bg-neutral-950 focus:text-white focus:placeholder:text-neutral-400 dark:placeholder:text-neutral-400 dark:focus:bg-white dark:focus:text-neutral-950 dark:focus:placeholder:text-neutral-600"
          />
          <DateField.Literal
            v-else
            :segment="segment"
            class="whitespace-pre text-neutral-600 dark:text-neutral-400"
          />
        </template>
      </DateField.Input>
    </DateField.Root>
    <Field.Description class="text-sm text-neutral-600 dark:text-neutral-400">
      Choose a weekday in November 2026.
    </Field.Description>
    <Field.Error class="text-sm text-red-700 dark:text-red-400" />
  </Field.Root>
</template>
