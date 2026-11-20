<script setup lang="ts">
import { useId } from 'vue';
import { DateField } from '@vase-ui/vue/date-field';

const id = useId();
const defaultValue = Temporal.PlainDate.from('2026-11-21');
</script>

<template>
  <div class="flex flex-col items-start gap-1">
    <label :for="id" class="text-sm font-bold text-neutral-950 dark:text-white">Return date</label>
    <DateField.Root :id="id" locale="en-US" :default-value="defaultValue" class="flex items-center">
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
      <DateField.Clear
        aria-label="Clear the return date"
        class="ml-1 flex size-8 items-center justify-center border border-neutral-950 bg-white text-neutral-950 hover:not-disabled:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 disabled:border-neutral-500 disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-disabled:bg-neutral-800 dark:focus-visible:outline-white dark:disabled:border-neutral-400 dark:disabled:text-neutral-400"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" stroke-width="1.5" />
        </svg>
      </DateField.Clear>
    </DateField.Root>
  </div>
</template>
