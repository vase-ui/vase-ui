<script setup lang="ts">
import { computed, shallowRef, useId } from 'vue';
import { Calendar } from '@vase-ui/vue/calendar';
import { DateField } from '@vase-ui/vue/date-field';
import { DatePicker } from '@vase-ui/vue/date-picker';
import { TimeField } from '@vase-ui/vue/time-field';
import { TimePicker } from '@vase-ui/vue/time-picker';

const labelId = useId();
const meetingDate = shallowRef<Temporal.PlainDate | null>(Temporal.PlainDate.from('2026-11-18'));
const meetingTime = shallowRef<Temporal.PlainTime | null>(Temporal.PlainTime.from('09:30'));
// A field has no value while one of its segments is empty.
const value = computed(() =>
  meetingDate.value && meetingTime.value
    ? meetingDate.value.toPlainDateTime(meetingTime.value)
    : null,
);

const buttonClassName =
  'h-8 w-8 cursor-pointer rounded-md outline-0 hover:not-disabled:not-aria-disabled:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-default disabled:opacity-40 aria-disabled:cursor-default aria-disabled:opacity-40 dark:hover:not-disabled:not-aria-disabled:bg-neutral-800 dark:focus-visible:outline-white';
const dayButtonClassName =
  'box-border size-9 cursor-pointer rounded-md border border-transparent outline-0 hover:enabled:not-data-selected:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 data-outside-month:not-data-selected:text-neutral-500 data-selected:bg-neutral-950 data-selected:text-white aria-[current=date]:border-neutral-400 disabled:cursor-default disabled:opacity-40 dark:hover:enabled:not-data-selected:bg-neutral-800 dark:focus-visible:outline-white dark:data-selected:bg-white dark:data-selected:text-neutral-950';
</script>

<template>
  <div role="group" :aria-labelledby="labelId" class="flex flex-col items-start gap-1">
    <div :id="labelId" class="text-sm font-bold text-neutral-950 dark:text-white">Meeting time</div>
    <div class="flex flex-wrap gap-2">
      <DatePicker.Root v-model="meetingDate" locale="en-US">
        <div
          class="box-border flex h-8 items-center border border-neutral-950 bg-white text-neutral-950 focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:text-white dark:focus-within:outline-white"
        >
          <DatePicker.Field aria-label="Date" class="flex items-center px-2">
            <DateField.Input
              class="flex items-center text-sm font-normal tabular-nums any-pointer-coarse:text-base"
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
          </DatePicker.Field>
          <DatePicker.Trigger
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
          </DatePicker.Trigger>
        </div>
        <DatePicker.Portal>
          <DatePicker.Positioner :side-offset="4">
            <DatePicker.Popup
              aria-label="Choose a meeting date"
              class="box-border flex origin-[var(--transform-origin)] flex-col gap-3 border border-neutral-950 bg-white p-3 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 outline-none transition-[scale,opacity] duration-100 ease-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
            >
              <DatePicker.Calendar class="relative box-border w-68 text-sm">
                <div class="absolute top-0 right-0 flex gap-1">
                  <Calendar.PreviousButton :class="buttonClassName"
                    >&lsaquo;</Calendar.PreviousButton
                  >
                  <Calendar.NextButton :class="buttonClassName">&rsaquo;</Calendar.NextButton>
                </div>
                <Calendar.Months>
                  <template #month="{ month }">
                    <Calendar.Month :month="month">
                      <Calendar.Caption class="mb-2 flex h-8 items-center font-semibold" />
                      <Calendar.Grid class="w-full table-fixed border-collapse">
                        <Calendar.GridHeader>
                          <Calendar.GridHeaderRow>
                            <template #weekday="{ weekday }">
                              <Calendar.Weekday
                                :weekday="weekday"
                                class="py-1 text-center text-xs font-medium text-neutral-600 dark:text-neutral-400"
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
              </DatePicker.Calendar>
            </DatePicker.Popup>
          </DatePicker.Positioner>
        </DatePicker.Portal>
      </DatePicker.Root>
      <TimePicker.Root v-model="meetingTime" locale="en-US" :hour-cycle="12">
        <div
          class="box-border flex h-8 items-center border border-neutral-950 bg-white text-neutral-950 focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:text-white dark:focus-within:outline-white"
        >
          <TimePicker.Field aria-label="Time" class="flex items-center px-2">
            <TimeField.Input
              class="flex items-center text-sm font-normal tabular-nums any-pointer-coarse:text-base"
            >
              <template #segment="{ segment }">
                <TimeField.Segment
                  v-if="segment.editable"
                  :segment="segment"
                  class="field-sizing-content px-0.5 text-center caret-transparent outline-0 placeholder:text-neutral-500 focus:bg-neutral-950 focus:text-white focus:placeholder:text-neutral-400 dark:placeholder:text-neutral-400 dark:focus:bg-white dark:focus:text-neutral-950 dark:focus:placeholder:text-neutral-600"
                />
                <TimeField.Literal
                  v-else
                  :segment="segment"
                  class="whitespace-pre text-neutral-600 dark:text-neutral-400"
                />
              </template>
            </TimeField.Input>
          </TimePicker.Field>
          <TimePicker.Trigger
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
              <circle cx="8" cy="8" r="5.5" />
              <path d="M8 4.5V8l2.5 1.5" />
            </svg>
          </TimePicker.Trigger>
        </div>
        <TimePicker.Portal>
          <TimePicker.Positioner :side-offset="4">
            <TimePicker.Popup
              aria-label="Choose a meeting time"
              class="box-border flex origin-[var(--transform-origin)] flex-col gap-3 border border-neutral-950 bg-white p-3 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 outline-none transition-[scale,opacity] duration-100 ease-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
            >
              <TimePicker.List
                class="box-border flex flex-col gap-0.5 overflow-y-auto text-sm tabular-nums max-h-56 w-32"
              >
                <template #item="{ time }">
                  <TimePicker.Item
                    :time="time"
                    class="box-border flex h-8 flex-none cursor-pointer items-center justify-center rounded-md px-3 whitespace-nowrap select-none hover:not-disabled:not-aria-disabled:not-data-selected:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-default disabled:opacity-40 aria-disabled:cursor-default aria-disabled:opacity-40 data-selected:bg-neutral-950 data-selected:text-white data-selected:focus-visible:outline-white dark:hover:not-disabled:not-aria-disabled:not-data-selected:bg-neutral-800 dark:focus-visible:outline-white dark:data-selected:bg-white dark:data-selected:text-neutral-950 dark:data-selected:focus-visible:outline-neutral-950"
                  />
                </template>
              </TimePicker.List>
            </TimePicker.Popup>
          </TimePicker.Positioner>
        </TimePicker.Portal>
      </TimePicker.Root>
    </div>
    <p class="text-sm text-neutral-600 dark:text-neutral-400">
      Value: {{ value?.toString() ?? 'none' }}
    </p>
  </div>
</template>
