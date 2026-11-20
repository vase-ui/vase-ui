<script setup lang="ts">
import { h, useId } from 'vue';
import type { FunctionalComponent } from 'vue';
import { NumberField } from '@vase-ui/vue/number-field';

const id = useId();

const PlusIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      width: '16',
      height: '16',
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-linecap': 'square',
      'stroke-linejoin': 'round',
      style: { display: 'block' },
    },
    [h('path', { d: 'M1.5 8h13M8 14.5v-13' })],
  );

const MinusIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      width: '16',
      height: '16',
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-linecap': 'square',
      'stroke-linejoin': 'round',
      style: { display: 'block' },
    },
    [h('path', { d: 'M1.5 8h13' })],
  );

const stepperClasses =
  'flex h-full w-8 items-center justify-center border border-neutral-950 bg-white bg-clip-padding text-neutral-950 outline-0 select-none dark:border-white dark:bg-neutral-950 dark:text-white hover:not-disabled:bg-neutral-100 dark:hover:not-disabled:bg-neutral-800 active:not-disabled:bg-neutral-200 dark:active:not-disabled:bg-neutral-700 disabled:border-neutral-500 disabled:text-neutral-500 dark:disabled:border-neutral-400 dark:disabled:text-neutral-400';
</script>

<template>
  <NumberField.Root :default-value="100" class="flex flex-col items-start gap-1">
    <NumberField.ScrubArea class="cursor-ew-resize font-bold select-none">
      <label :for="id" class="cursor-ew-resize text-sm font-bold text-neutral-950 dark:text-white"
        >Amount</label
      >
    </NumberField.ScrubArea>

    <NumberField.Group class="flex h-8">
      <NumberField.Decrement aria-label="Decrease" :class="[stepperClasses, 'border-r-0']">
        <MinusIcon />
      </NumberField.Decrement>
      <NumberField.Input
        :id="id"
        class="h-full w-[7ch] border border-neutral-950 bg-white px-2 text-left text-sm font-normal text-neutral-950 tabular-nums any-pointer-coarse:text-base dark:border-white dark:bg-neutral-950 dark:text-white focus:z-1 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white"
      />
      <NumberField.Increment aria-label="Increase" :class="[stepperClasses, 'border-l-0']">
        <PlusIcon />
      </NumberField.Increment>
    </NumberField.Group>
  </NumberField.Root>
</template>
