<script setup lang="ts">
import { useId } from 'vue';
import { DateField } from '@vase-ui/vue/date-field';
import { DateRangePicker } from '@vase-ui/vue/date-range-picker';
import { Calendar } from '@vase-ui/vue/calendar';

const id = useId();
const defaultValue: [Temporal.PlainDate, Temporal.PlainDate] = [
  Temporal.PlainDate.from('2026-11-18'),
  Temporal.PlainDate.from('2026-11-22'),
];

const buttonClassName =
  'h-8 w-8 cursor-pointer rounded-md outline-0 hover:not-disabled:not-aria-disabled:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-default disabled:opacity-40 aria-disabled:cursor-default aria-disabled:opacity-40 dark:hover:not-disabled:not-aria-disabled:bg-neutral-800 dark:focus-visible:outline-white';
const dayButtonClassName =
  'm-0 box-border size-9 cursor-pointer select-none rounded-md border-0 bg-transparent p-0 font-[inherit] text-inherit focus-visible:relative focus-visible:z-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-default disabled:opacity-40 data-range-end:bg-neutral-950 data-range-end:text-white data-range-middle:rounded-none data-range-middle:bg-neutral-100 data-range-start:bg-neutral-950 data-range-start:text-white aria-[current=date]:font-bold aria-[current=date]:underline data-unavailable:line-through dark:focus-visible:outline-white dark:data-range-end:bg-white dark:data-range-end:text-neutral-950 dark:data-range-middle:bg-neutral-800 dark:data-range-start:bg-white dark:data-range-start:text-neutral-950';
const segmentClassName =
  'px-0.5 text-center caret-transparent outline-0 placeholder:text-neutral-500 focus:bg-neutral-950 focus:text-white focus:placeholder:text-neutral-400 dark:placeholder:text-neutral-400 dark:focus:bg-white dark:focus:text-neutral-950 dark:focus:placeholder:text-neutral-600';
const literalClassName = 'whitespace-pre text-neutral-600 dark:text-neutral-400';
const inputClassName =
  'flex items-center text-sm font-normal tabular-nums any-pointer-coarse:text-base';
</script>

<template>
  <div class="flex flex-col items-start gap-1">
    <label :for="id" class="text-sm font-bold text-neutral-950 dark:text-white">Trip dates</label>
    <DateRangePicker.Root :default-value="defaultValue" locale="en-US">
      <div
        class="box-border flex h-8 items-center border border-neutral-950 bg-white text-neutral-950 focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:text-white dark:focus-within:outline-white"
      >
        <DateRangePicker.StartField :id="id" class="flex items-center px-2">
          <DateField.Input :class="inputClassName">
            <template #segment="{ segment }">
              <DateField.Segment
                v-if="segment.editable"
                :segment="segment"
                :class="segmentClassName"
              />
              <DateField.Literal v-else :segment="segment" :class="literalClassName" />
            </template>
          </DateField.Input>
        </DateRangePicker.StartField>
        <span aria-hidden="true" class="text-neutral-600 select-none dark:text-neutral-400"
          >&ndash;</span
        >
        <DateRangePicker.EndField class="flex items-center px-2">
          <DateField.Input :class="inputClassName">
            <template #segment="{ segment }">
              <DateField.Segment
                v-if="segment.editable"
                :segment="segment"
                :class="segmentClassName"
              />
              <DateField.Literal v-else :segment="segment" :class="literalClassName" />
            </template>
          </DateField.Input>
        </DateRangePicker.EndField>
        <DateRangePicker.Trigger
          class="box-border flex h-full w-[1.875rem] items-center justify-center border-0 border-l border-neutral-950 bg-transparent p-0 select-none hover:not-data-disabled:bg-neutral-100 data-disabled:text-neutral-500 data-popup-open:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:border-white dark:hover:not-data-disabled:bg-neutral-800 dark:data-disabled:text-neutral-400 dark:data-popup-open:bg-neutral-800 dark:focus-visible:outline-white"
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-linecap="square"
          >
            <rect x="2.5" y="3.5" width="11" height="10" />
            <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
          </svg>
        </DateRangePicker.Trigger>
      </div>
      <DateRangePicker.Portal>
        <DateRangePicker.Positioner :side-offset="4">
          <DateRangePicker.Popup
            aria-label="Choose trip dates"
            class="box-border flex origin-[var(--transform-origin)] flex-col gap-3 border border-neutral-950 bg-white p-3 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 outline-none transition-[scale,opacity] duration-100 ease-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
          >
            <DateRangePicker.Calendar class="relative box-border text-sm">
              <div class="absolute top-0 right-0 flex gap-1">
                <Calendar.PreviousButton :class="buttonClassName">
                  &lsaquo;
                </Calendar.PreviousButton>
                <Calendar.NextButton :class="buttonClassName">&rsaquo;</Calendar.NextButton>
              </div>
              <Calendar.Months>
                <template #month="{ month }">
                  <Calendar.Month :month="month">
                    <Calendar.Caption class="mb-2 flex h-8 items-center font-semibold" />
                    <Calendar.Grid class="border-collapse">
                      <Calendar.GridHeader>
                        <Calendar.GridHeaderRow>
                          <template #weekday="{ weekday }">
                            <Calendar.Weekday
                              :weekday="weekday"
                              class="h-8 w-9 p-0 text-xs font-normal text-neutral-600 dark:text-neutral-400"
                            />
                          </template>
                        </Calendar.GridHeaderRow>
                      </Calendar.GridHeader>
                      <Calendar.GridBody>
                        <template #week="{ week }">
                          <Calendar.Week :week="week">
                            <template #day="{ day }">
                              <Calendar.Day :day="day" class="p-0 text-center">
                                <Calendar.DayButton :class="dayButtonClassName" />
                              </Calendar.Day>
                            </template>
                          </Calendar.Week>
                        </template>
                      </Calendar.GridBody>
                    </Calendar.Grid>
                  </Calendar.Month>
                </template>
              </Calendar.Months>
            </DateRangePicker.Calendar>
          </DateRangePicker.Popup>
        </DateRangePicker.Positioner>
      </DateRangePicker.Portal>
    </DateRangePicker.Root>
  </div>
</template>
