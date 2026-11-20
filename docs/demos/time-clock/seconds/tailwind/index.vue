<script setup lang="ts">
import { TimeClock } from '@vase-ui/vue/time-clock';

const time = Temporal.PlainTime.from('10:30:45');

const buttonClass =
  'flex h-10 min-w-10 items-center justify-center border border-neutral-950 bg-white px-2 leading-6 text-neutral-950 tabular-nums select-none focus-visible:z-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:border-neutral-500 disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:focus-visible:outline-white dark:disabled:border-neutral-400 dark:disabled:text-neutral-400';
const triggerClass =
  'text-xl hover:not-disabled:not-aria-pressed:bg-neutral-100 aria-pressed:bg-neutral-950 aria-pressed:not-disabled:text-white dark:hover:not-disabled:not-aria-pressed:bg-neutral-800 dark:aria-pressed:bg-white dark:aria-pressed:not-disabled:text-neutral-950';
</script>

<template>
  <TimeClock.Root
    class="flex flex-col items-center gap-3 text-neutral-950 dark:text-white"
    aria-label="Timer"
    locale="en-US"
    granularity="second"
    :hour-cycle="24"
    :default-value="time"
  >
    <div class="flex items-center gap-1">
      <TimeClock.ViewTrigger view="hour" :class="[buttonClass, triggerClass]" />
      <span aria-hidden="true" class="text-xl font-bold">:</span>
      <TimeClock.ViewTrigger view="minute" :class="[buttonClass, triggerClass]" />
      <span aria-hidden="true" class="text-xl font-bold">:</span>
      <TimeClock.ViewTrigger view="second" :class="[buttonClass, triggerClass]" />
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
  </TimeClock.Root>
</template>
