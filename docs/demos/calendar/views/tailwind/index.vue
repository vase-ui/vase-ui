<script setup lang="ts">
import { Calendar } from '@vase-ui/vue/calendar';
</script>

<template>
  <Calendar.Root
    locale="en-US"
    class="relative box-border min-h-79 w-72 rounded-lg border border-neutral-200 bg-white p-3 text-sm text-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
  >
    <div class="mb-2 flex items-center justify-between">
      <Calendar.PreviousButton
        class="h-8 w-8 cursor-pointer rounded-md outline-0 hover:not-disabled:not-aria-disabled:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-default disabled:opacity-40 aria-disabled:cursor-default aria-disabled:opacity-40 dark:hover:not-disabled:not-aria-disabled:bg-neutral-800 dark:focus-visible:outline-white"
        >&lsaquo;</Calendar.PreviousButton
      >
      <Calendar.ViewTrigger
        aria-description="Shows the years, or the days again"
        class="h-8 cursor-pointer rounded-md px-3 font-semibold outline-0 hover:not-disabled:not-aria-disabled:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-default disabled:opacity-40 aria-disabled:cursor-default aria-disabled:opacity-40 dark:hover:not-disabled:not-aria-disabled:bg-neutral-800 dark:focus-visible:outline-white"
      />
      <Calendar.NextButton
        class="h-8 w-8 cursor-pointer rounded-md outline-0 hover:not-disabled:not-aria-disabled:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-default disabled:opacity-40 aria-disabled:cursor-default aria-disabled:opacity-40 dark:hover:not-disabled:not-aria-disabled:bg-neutral-800 dark:focus-visible:outline-white"
        >&rsaquo;</Calendar.NextButton
      >
    </div>
    <Calendar.Months>
      <template #month="{ month }">
        <Calendar.Month :month="month">
          <Calendar.Grid class="w-full table-fixed border-collapse">
            <Calendar.GridHeader>
              <Calendar.GridHeaderRow>
                <template #weekday="{ weekday }">
                  <Calendar.Weekday
                    :weekday="weekday"
                    class="py-1 text-center text-xs leading-5 font-medium text-neutral-600 dark:text-neutral-400"
                  />
                </template>
              </Calendar.GridHeaderRow>
            </Calendar.GridHeader>
            <Calendar.GridBody>
              <template #week="{ week }">
                <Calendar.Week :week="week">
                  <template #day="{ day }">
                    <Calendar.Day :day="day" class="p-0 text-center">
                      <Calendar.DayButton
                        class="box-border size-9 cursor-pointer rounded-md border border-transparent outline-0 hover:enabled:not-data-selected:not-data-unavailable:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 data-outside-month:not-data-selected:text-neutral-500 data-selected:bg-neutral-950 data-selected:text-white aria-[current=date]:border-neutral-400 data-unavailable:cursor-default data-unavailable:line-through disabled:cursor-default disabled:opacity-40 dark:hover:enabled:not-data-selected:not-data-unavailable:bg-neutral-800 dark:focus-visible:outline-white dark:data-outside-month:not-data-selected:text-neutral-400 dark:data-selected:bg-white dark:data-selected:text-neutral-950"
                      />
                    </Calendar.Day>
                  </template>
                </Calendar.Week>
              </template>
            </Calendar.GridBody>
          </Calendar.Grid>
        </Calendar.Month>
      </template>
    </Calendar.Months>
    <Calendar.MonthGrid class="flex flex-col gap-1">
      <template #row="{ months }">
        <Calendar.MonthGridRow class="grid grid-cols-3 gap-1">
          <Calendar.MonthCell
            v-for="month in months"
            :key="month.toString()"
            :month="month"
            class="box-border h-10 cursor-pointer rounded-md border border-transparent outline-0 hover:enabled:not-aria-selected:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 aria-[current=date]:border-neutral-400 aria-selected:bg-neutral-950 aria-selected:text-white disabled:cursor-default disabled:opacity-40 dark:hover:enabled:not-aria-selected:bg-neutral-800 dark:focus-visible:outline-white dark:aria-selected:bg-white dark:aria-selected:text-neutral-950"
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
            class="box-border h-10 cursor-pointer rounded-md border border-transparent outline-0 hover:enabled:not-aria-selected:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 aria-[current=date]:border-neutral-400 aria-selected:bg-neutral-950 aria-selected:text-white disabled:cursor-default disabled:opacity-40 dark:hover:enabled:not-aria-selected:bg-neutral-800 dark:focus-visible:outline-white dark:aria-selected:bg-white dark:aria-selected:text-neutral-950"
          />
        </Calendar.YearGridRow>
      </template>
    </Calendar.YearGrid>
  </Calendar.Root>
</template>
