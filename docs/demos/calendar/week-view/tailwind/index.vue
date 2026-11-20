<script setup lang="ts">
import { shallowRef } from 'vue';
import { Calendar } from '@vase-ui/vue/calendar';

const captionFormat: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
const selected = shallowRef<Temporal.PlainDate | null>(null);
</script>

<template>
  <Calendar.Root
    v-model="selected"
    :visible-duration="{ weeks: 1 }"
    locale="en-US"
    aria-label="Day of the agenda"
    class="relative box-border w-72 rounded-lg border border-neutral-200 bg-white p-3 text-sm text-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
  >
    <div class="absolute top-3 right-3 flex gap-1">
      <Calendar.PreviousButton
        class="h-8 w-8 cursor-pointer rounded-md outline-0 hover:not-disabled:not-aria-disabled:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-default disabled:opacity-40 aria-disabled:cursor-default aria-disabled:opacity-40 dark:hover:not-disabled:not-aria-disabled:bg-neutral-800 dark:focus-visible:outline-white"
        >&lsaquo;</Calendar.PreviousButton
      >
      <Calendar.NextButton
        class="h-8 w-8 cursor-pointer rounded-md outline-0 hover:not-disabled:not-aria-disabled:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-default disabled:opacity-40 aria-disabled:cursor-default aria-disabled:opacity-40 dark:hover:not-disabled:not-aria-disabled:bg-neutral-800 dark:focus-visible:outline-white"
        >&rsaquo;</Calendar.NextButton
      >
    </div>
    <Calendar.Months>
      <template #month="{ month }">
        <Calendar.Month :month="month">
          <Calendar.Caption
            :format="captionFormat"
            class="mb-2 flex h-8 items-center font-semibold"
          />
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
  </Calendar.Root>
</template>
