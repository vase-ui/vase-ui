<script setup lang="ts">
import { Calendar } from '@vase-ui/vue/calendar';
import { DateField } from '@vase-ui/vue/date-field';
import { DatePicker } from '@vase-ui/vue/date-picker';
import { Field } from '@vase-ui/vue/field';
import { Popover } from '@vase-ui/vue/popover';

const defaultValue = Temporal.PlainDate.from('2026-12-01');
const minDate = Temporal.PlainDate.from('2026-11-01');
const maxDate = Temporal.PlainDate.from('2026-11-30');
// Saturday and Sunday.
const unavailableDates = { dayOfWeek: [6, 7] };

const buttonClassName =
  'h-8 w-8 cursor-pointer rounded-md outline-0 hover:not-disabled:not-aria-disabled:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-default disabled:opacity-40 aria-disabled:cursor-default aria-disabled:opacity-40 dark:hover:not-disabled:not-aria-disabled:bg-neutral-800 dark:focus-visible:outline-white';
const dayButtonClassName =
  'box-border size-9 cursor-pointer rounded-md border border-transparent outline-0 hover:enabled:not-data-selected:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 data-outside-month:not-data-selected:text-neutral-500 data-selected:bg-neutral-950 data-selected:text-white aria-[current=date]:border-neutral-400 disabled:cursor-default disabled:opacity-40 dark:hover:enabled:not-data-selected:bg-neutral-800 dark:focus-visible:outline-white dark:data-selected:bg-white dark:data-selected:text-neutral-950';
</script>

<template>
  <Field.Root name="checkIn" class="flex flex-col items-start gap-1">
    <Field.Label class="text-sm font-bold text-neutral-950 dark:text-white"
      >Check-in date</Field.Label
    >
    <DatePicker.Root
      required
      :default-value="defaultValue"
      :min="minDate"
      :max="maxDate"
      :unavailable-dates="unavailableDates"
      locale="en-US"
    >
      <div
        class="box-border flex h-8 items-center border border-neutral-950 bg-white text-neutral-950 focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:text-white dark:focus-within:outline-white"
      >
        <DatePicker.Field class="flex items-center px-2">
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
          aria-label="Choose date"
          class="box-border flex h-full w-[1.875rem] items-center justify-center border-0 border-l border-neutral-950 bg-transparent p-0 select-none hover:not-disabled:bg-neutral-100 disabled:text-neutral-500 aria-expanded:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:border-white dark:hover:not-disabled:bg-neutral-800 dark:disabled:text-neutral-400 dark:aria-expanded:bg-neutral-800 dark:focus-visible:outline-white"
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
      <Popover.Portal>
        <DatePicker.Positioner :side-offset="4">
          <Transition
            enter-from-class="opacity-0 scale-[0.98]"
            leave-to-class="opacity-0 scale-[0.98]"
            appear
          >
            <DatePicker.Popup
              aria-label="Choose a check-in date"
              class="box-border flex origin-[var(--transform-origin)] flex-col gap-3 border border-neutral-950 bg-white p-3 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 outline-none transition-[scale,opacity] duration-100 ease-out dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
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
          </Transition>
        </DatePicker.Positioner>
      </Popover.Portal>
    </DatePicker.Root>
    <Field.Description class="text-sm text-neutral-600 dark:text-neutral-400"
      >Choose a weekday in November 2026.</Field.Description
    >
    <Field.Error class="text-sm text-red-700 dark:text-red-400" />
  </Field.Root>
</template>
