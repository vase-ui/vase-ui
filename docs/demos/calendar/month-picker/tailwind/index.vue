<script setup lang="ts">
import { shallowRef } from 'vue';
import { Calendar } from '@vase-ui/vue/calendar';

const today = Temporal.PlainDate.from('2026-11-14');
const selected = shallowRef<Temporal.PlainYearMonth | null>(
  Temporal.PlainYearMonth.from('2026-11'),
);
</script>

<template>
  <Calendar.Root
    v-model:value="selected"
    :today="today"
    locale="en-US"
    class="relative box-border w-72 rounded-lg border border-neutral-200 bg-white p-3 text-sm text-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
  >
    <div class="mb-2 flex items-center justify-between">
      <Calendar.PreviousButton
        class="h-8 w-8 cursor-pointer rounded-md outline-0 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-transparent dark:hover:bg-neutral-800 dark:focus-visible:outline-white dark:aria-disabled:hover:bg-transparent"
        >&lsaquo;</Calendar.PreviousButton
      >
      <Calendar.ViewTrigger
        class="h-8 cursor-pointer rounded-md px-3 font-semibold outline-0 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 dark:hover:bg-neutral-800 dark:focus-visible:outline-white"
      />
      <Calendar.NextButton
        class="h-8 w-8 cursor-pointer rounded-md outline-0 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-transparent dark:hover:bg-neutral-800 dark:focus-visible:outline-white dark:aria-disabled:hover:bg-transparent"
        >&rsaquo;</Calendar.NextButton
      >
    </div>
    <Calendar.MonthGrid class="flex flex-col gap-1">
      <template #row="{ months }">
        <Calendar.MonthGridRow class="grid grid-cols-3 gap-1">
          <Calendar.MonthCell
            v-for="month in months"
            :key="month.toString()"
            :month="month"
            class="box-border h-10 cursor-pointer rounded-md border border-transparent outline-0 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 data-[current]:border-neutral-400 data-[selected]:bg-neutral-950 data-[selected]:text-white data-[selected]:hover:bg-neutral-950 disabled:cursor-default disabled:opacity-40 dark:hover:bg-neutral-800 dark:focus-visible:outline-white dark:data-[selected]:bg-white dark:data-[selected]:text-neutral-950 dark:data-[selected]:hover:bg-white"
          />
        </Calendar.MonthGridRow>
      </template>
    </Calendar.MonthGrid>
    <Calendar.YearGrid class="flex flex-col gap-1">
      <template #row="{ years }">
        <Calendar.YearGridRow class="grid grid-cols-3 gap-1">
          <Calendar.YearCell
            v-for="year in years"
            :key="year.toString()"
            :year="year"
            class="box-border h-10 cursor-pointer rounded-md border border-transparent outline-0 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 data-[current]:border-neutral-400 data-[selected]:bg-neutral-950 data-[selected]:text-white data-[selected]:hover:bg-neutral-950 disabled:cursor-default disabled:opacity-40 dark:hover:bg-neutral-800 dark:focus-visible:outline-white dark:data-[selected]:bg-white dark:data-[selected]:text-neutral-950 dark:data-[selected]:hover:bg-white"
          />
        </Calendar.YearGridRow>
      </template>
    </Calendar.YearGrid>
  </Calendar.Root>
</template>
