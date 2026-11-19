<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Checkbox } from '@vase-ui/vue/checkbox';

const CheckIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      width: '16',
      height: '16',
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      'aria-hidden': 'true',
    },
    [h('path', { d: 'm2.5 8.5 4 4 7-9' })],
  );
</script>

<template>
  <label class="flex items-center gap-2 text-sm font-normal text-neutral-950 dark:text-white">
    <span class="relative flex shrink-0">
      <Checkbox
        default-checked
        class="peer m-0 size-4 appearance-none rounded-none border border-neutral-950 bg-white p-0 checked:bg-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:checked:bg-white dark:focus-visible:outline-white"
      />
      <CheckIcon
        class="pointer-events-none absolute inset-0 hidden text-white peer-checked:block dark:text-neutral-950"
      />
    </span>
    Enable notifications
  </label>
</template>
