<script setup lang="ts">
import { useId } from 'vue';
import { Calendar } from '@vase-ui/vue/calendar';
import { DateField } from '@vase-ui/vue/date-field';
import { DatePicker } from '@vase-ui/vue/date-picker';
import { Popover } from '@vase-ui/vue/popover';

const id = useId();
const defaultValue = Temporal.PlainYearMonth.from('2026-11');

const buttonClassName =
  'h-8 w-8 cursor-pointer rounded-md outline-0 hover:not-disabled:not-aria-disabled:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-default disabled:opacity-40 aria-disabled:cursor-default aria-disabled:opacity-40 dark:hover:not-disabled:not-aria-disabled:bg-neutral-800 dark:focus-visible:outline-white';
const titleClassName =
  'h-8 cursor-pointer rounded-md px-2 font-semibold outline-0 hover:not-disabled:not-aria-disabled:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-default disabled:opacity-40 aria-disabled:cursor-default aria-disabled:opacity-40 dark:hover:not-disabled:not-aria-disabled:bg-neutral-800 dark:focus-visible:outline-white';
const cellClassName =
  'box-border h-10 flex-1 cursor-pointer rounded-md border border-transparent outline-0 hover:enabled:not-aria-selected:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 aria-[current=date]:border-neutral-400 data-disabled:cursor-default data-disabled:opacity-40 aria-selected:bg-neutral-950 aria-selected:text-white dark:hover:enabled:not-aria-selected:bg-neutral-800 dark:focus-visible:outline-white dark:aria-selected:bg-white dark:aria-selected:text-neutral-950';

const popupHiddenClass = 'scale-[0.98] opacity-0';
</script>

<template>
  <div class="flex flex-col items-start gap-1">
    <label :for="id" class="text-sm font-bold text-neutral-950 dark:text-white"
      >Billing month</label
    >
    <DatePicker.Root :default-value="defaultValue" locale="en-US">
      <div
        class="box-border flex h-8 items-center border border-neutral-950 bg-white text-neutral-950 focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:text-white dark:focus-within:outline-white"
      >
        <DatePicker.Field :id="id" class="flex items-center px-2">
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
            :enter-from-class="popupHiddenClass"
            :leave-to-class="popupHiddenClass"
            appear
          >
            <DatePicker.Popup
              aria-label="Choose a billing month"
              class="box-border flex origin-[var(--transform-origin)] flex-col gap-3 border border-neutral-950 bg-white p-3 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 outline-none transition-[scale,opacity] duration-100 ease-out dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
            >
              <DatePicker.Calendar class="relative box-border w-68 text-sm">
                <div class="mb-2 flex items-center justify-between">
                  <Calendar.PreviousButton :class="buttonClassName"
                    >&lsaquo;</Calendar.PreviousButton
                  >
                  <Calendar.ViewTrigger :class="titleClassName" />
                  <Calendar.NextButton :class="buttonClassName">&rsaquo;</Calendar.NextButton>
                </div>
                <Calendar.MonthGrid class="flex flex-col gap-1">
                  <template #row="{ months }">
                    <Calendar.MonthGridRow class="flex gap-1">
                      <Calendar.MonthCell
                        v-for="month in months"
                        :key="month.toString()"
                        :month="month"
                        :class="cellClassName"
                      />
                    </Calendar.MonthGridRow>
                  </template>
                </Calendar.MonthGrid>
                <Calendar.YearGrid class="flex flex-col gap-1">
                  <template #row="{ years }">
                    <Calendar.YearGridRow class="flex gap-1">
                      <Calendar.YearCell
                        v-for="year in years"
                        :key="year.toString()"
                        :year="year"
                        :class="cellClassName"
                      />
                    </Calendar.YearGridRow>
                  </template>
                </Calendar.YearGrid>
              </DatePicker.Calendar>
            </DatePicker.Popup>
          </Transition>
        </DatePicker.Positioner>
      </Popover.Portal>
    </DatePicker.Root>
  </div>
</template>
