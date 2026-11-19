<script setup lang="ts">
import { h, useId } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';

const id = useId();

const CheckIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      width: '16',
      height: '16',
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      style: { display: 'block' },
    },
    [h('path', { d: 'm2.5 8.5 4 4 7-9' })],
  );
</script>

<template>
  <CheckboxGroup
    :aria-labelledby="id"
    :default-value="['fuji-apple']"
    class="flex flex-col items-start gap-1 text-neutral-950 dark:text-white"
  >
    <div class="text-sm font-bold" :id="id">Apples</div>

    <label class="flex items-center gap-2 text-sm font-normal text-neutral-950 dark:text-white">
      <span class="relative flex shrink-0">
        <Checkbox
          name="apple"
          value="fuji-apple"
          class="m-0 size-4 appearance-none rounded-none border border-neutral-950 bg-white p-0 checked:bg-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:checked:bg-white dark:focus-visible:outline-white peer"
        />
        <span
          class="pointer-events-none absolute inset-0 hidden items-center justify-center text-white peer-checked:flex dark:text-neutral-950"
          ><CheckIcon
        /></span>
      </span>
      Fuji
    </label>

    <label class="flex items-center gap-2 text-sm font-normal text-neutral-950 dark:text-white">
      <span class="relative flex shrink-0">
        <Checkbox
          name="apple"
          value="gala-apple"
          class="m-0 size-4 appearance-none rounded-none border border-neutral-950 bg-white p-0 checked:bg-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:checked:bg-white dark:focus-visible:outline-white peer"
        />
        <span
          class="pointer-events-none absolute inset-0 hidden items-center justify-center text-white peer-checked:flex dark:text-neutral-950"
          ><CheckIcon
        /></span>
      </span>
      Gala
    </label>

    <label class="flex items-center gap-2 text-sm font-normal text-neutral-950 dark:text-white">
      <span class="relative flex shrink-0">
        <Checkbox
          name="apple"
          value="granny-smith-apple"
          class="m-0 size-4 appearance-none rounded-none border border-neutral-950 bg-white p-0 checked:bg-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:checked:bg-white dark:focus-visible:outline-white peer"
        />
        <span
          class="pointer-events-none absolute inset-0 hidden items-center justify-center text-white peer-checked:flex dark:text-neutral-950"
          ><CheckIcon
        /></span>
      </span>
      Granny Smith
    </label>
  </CheckboxGroup>
</template>
