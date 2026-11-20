<script setup lang="ts">
import { shallowRef, useId } from 'vue';
import { DateField } from '@vase-ui/vue/date-field';

const id = useId();
const value = shallowRef<Temporal.PlainDateTime | null>(
  Temporal.PlainDateTime.from('2026-11-14T15:04'),
);
</script>

<template>
  <div class="flex flex-col items-start gap-1">
    <label :for="id" class="text-sm font-bold text-neutral-950 dark:text-white">Appointment</label>
    <DateField.Root :id="id" v-model="value" locale="en-US" class="flex items-center">
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
    <p class="text-sm text-neutral-600 dark:text-neutral-400">
      Value: {{ value?.toString() ?? 'none' }}
    </p>
  </div>
</template>
