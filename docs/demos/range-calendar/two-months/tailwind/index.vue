<script setup lang="ts">
import { RangeCalendar } from '@vase-ui/vue/range-calendar';

const defaultValue: [Temporal.PlainDate, Temporal.PlainDate] = [
  Temporal.PlainDate.from('2026-11-24'),
  Temporal.PlainDate.from('2026-12-03'),
];
</script>

<template>
  <RangeCalendar.Root
    class="relative box-border inline-block rounded-lg border border-neutral-200 bg-white p-3 text-sm text-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
    aria-label="Conference dates"
    :number-of-months="2"
    paged-navigation
    locale="en-US"
    :default-value="defaultValue"
  >
    <RangeCalendar.PreviousButton
      class="absolute top-3 box-border flex size-8 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-inherit hover:not-data-disabled:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 data-disabled:cursor-default data-disabled:opacity-40 dark:hover:not-data-disabled:bg-neutral-800 dark:focus-visible:outline-white start-3"
    >
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M10 3 5 8l5 5" />
      </svg>
    </RangeCalendar.PreviousButton>
    <RangeCalendar.NextButton
      class="absolute top-3 box-border flex size-8 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-inherit hover:not-data-disabled:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 data-disabled:cursor-default data-disabled:opacity-40 dark:hover:not-data-disabled:bg-neutral-800 dark:focus-visible:outline-white end-3"
    >
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="m6 3 5 5-5 5" />
      </svg>
    </RangeCalendar.NextButton>
    <RangeCalendar.Months class="flex gap-6">
      <template #month="{ month }">
        <RangeCalendar.Month :month="month" class="flex flex-col gap-2">
          <RangeCalendar.Caption class="text-center leading-8 font-medium" />
          <RangeCalendar.Grid class="border-collapse">
            <RangeCalendar.GridHeader>
              <RangeCalendar.GridHeaderRow>
                <template #weekday="{ weekday }">
                  <RangeCalendar.Weekday
                    :weekday="weekday"
                    class="h-8 w-9 p-0 text-xs font-normal text-neutral-600 dark:text-neutral-400"
                  />
                </template>
              </RangeCalendar.GridHeaderRow>
            </RangeCalendar.GridHeader>
            <RangeCalendar.GridBody>
              <template #week="{ week }">
                <RangeCalendar.Week :week="week">
                  <template #day="{ day }">
                    <RangeCalendar.Day :day="day" class="p-0 text-center">
                      <RangeCalendar.DayButton
                        class="m-0 box-border size-9 cursor-pointer select-none rounded-md border-0 bg-transparent p-0 font-[inherit] text-inherit focus-visible:relative focus-visible:z-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 data-disabled:cursor-default data-disabled:opacity-40 data-range-end:bg-neutral-950 data-range-end:text-white data-range-middle:rounded-none data-range-middle:bg-neutral-100 data-range-start:bg-neutral-950 data-range-start:text-white data-today:font-bold data-today:underline data-unavailable:line-through dark:focus-visible:outline-white dark:data-range-end:bg-white dark:data-range-end:text-neutral-950 dark:data-range-middle:bg-neutral-800 dark:data-range-start:bg-white dark:data-range-start:text-neutral-950"
                      />
                    </RangeCalendar.Day>
                  </template>
                </RangeCalendar.Week>
              </template>
            </RangeCalendar.GridBody>
          </RangeCalendar.Grid>
        </RangeCalendar.Month>
      </template>
    </RangeCalendar.Months>
  </RangeCalendar.Root>
</template>
