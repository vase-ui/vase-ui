<script setup lang="ts">
import { useId } from 'vue';
import { TimeClock } from '@vase-ui/vue/time-clock';
import { TimeField } from '@vase-ui/vue/time-field';
import { TimePicker } from '@vase-ui/vue/time-picker';

const id = useId();
const defaultValue = Temporal.PlainTime.from('10:30');

const buttonClass =
  'flex h-10 min-w-10 items-center justify-center border border-neutral-950 bg-white px-2 leading-6 text-neutral-950 tabular-nums select-none focus-visible:z-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:border-neutral-500 disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:focus-visible:outline-white dark:disabled:border-neutral-400 dark:disabled:text-neutral-400';
const triggerClass =
  'text-xl hover:not-disabled:not-aria-pressed:bg-neutral-100 aria-pressed:bg-neutral-950 aria-pressed:not-disabled:text-white dark:hover:not-disabled:not-aria-pressed:bg-neutral-800 dark:aria-pressed:bg-white dark:aria-pressed:not-disabled:text-neutral-950';
const dayPeriodClass =
  'text-sm hover:not-disabled:not-aria-pressed:bg-neutral-100 aria-pressed:bg-neutral-950 aria-pressed:not-disabled:text-white dark:hover:not-disabled:not-aria-pressed:bg-neutral-800 dark:aria-pressed:bg-white dark:aria-pressed:not-disabled:text-neutral-950';
</script>

<template>
  <div class="flex flex-col items-start gap-1">
    <label :for="id" class="text-sm font-bold text-neutral-950 dark:text-white"
      >Reminder time</label
    >
    <TimePicker.Root :default-value="defaultValue" locale="en-US" :hour-cycle="12">
      <div
        class="box-border flex h-8 items-center border border-neutral-950 bg-white text-neutral-950 focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:text-white dark:focus-within:outline-white"
      >
        <TimePicker.Field :id="id" class="flex items-center px-2">
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
            aria-label="Choose a reminder time"
            class="box-border flex origin-[var(--transform-origin)] flex-col gap-3 border border-neutral-950 bg-white p-3 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 outline-none transition-[scale,opacity] duration-100 ease-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
          >
            <TimePicker.Clock
              class="flex flex-col items-center gap-3 text-neutral-950 dark:text-white"
            >
              <div class="flex items-center gap-1">
                <TimeClock.ViewTrigger view="hour" :class="[buttonClass, triggerClass]" />
                <span aria-hidden="true" class="text-xl font-bold">:</span>
                <TimeClock.ViewTrigger view="minute" :class="[buttonClass, triggerClass]" />
                <TimeClock.DayPeriod value="am" :class="[buttonClass, dayPeriodClass]" />
                <TimeClock.DayPeriod value="pm" :class="[buttonClass, dayPeriodClass]" />
              </div>
              <TimeClock.Face
                class="relative size-56 cursor-pointer rounded-full border border-neutral-950 bg-neutral-100 select-none [--radius:5.5rem] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-neutral-950 data-disabled:cursor-default data-readonly:cursor-default dark:border-white dark:bg-neutral-800 dark:has-focus-visible:outline-white"
              >
                <TimeClock.Hand
                  class="pointer-events-none absolute bottom-1/2 left-1/2 h-[calc(var(--time-clock-hand-length)*var(--radius))] w-0.5 origin-bottom -translate-x-1/2 rotate-(--time-clock-hand-angle) bg-neutral-950 data-between-numbers:after:absolute data-between-numbers:after:-top-1 data-between-numbers:after:left-1/2 data-between-numbers:after:size-2 data-between-numbers:after:-translate-x-1/2 data-between-numbers:after:rounded-full data-between-numbers:after:bg-neutral-950 data-between-numbers:after:content-[''] dark:bg-white dark:data-between-numbers:after:bg-white"
                />
                <template #number="{ number }">
                  <TimeClock.Number
                    :number="number"
                    class="pointer-events-none absolute top-1/2 left-1/2 -mt-4 -ml-4 flex size-8 items-center justify-center rounded-full text-sm tabular-nums transform-[rotate(var(--time-clock-number-angle))_translateY(calc(var(--time-clock-number-radius)*var(--radius)*-1))_rotate(calc(var(--time-clock-number-angle)*-1))] data-disabled:text-neutral-600 data-inner:-mt-3.5 data-inner:-ml-3.5 data-inner:size-7 data-inner:text-xs data-selected:bg-neutral-950 data-selected:not-data-disabled:text-white dark:data-disabled:text-neutral-400 dark:data-selected:bg-white dark:data-selected:not-data-disabled:text-neutral-950"
                  />
                </template>
              </TimeClock.Face>
            </TimePicker.Clock>
          </TimePicker.Popup>
        </TimePicker.Positioner>
      </TimePicker.Portal>
    </TimePicker.Root>
  </div>
</template>
