<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Toggle } from '@vase-ui/vue/toggle';
import { ToggleGroup } from '@vase-ui/vue/toggle-group';

const ICON_PROPS = {
  width: '16',
  height: '16',
  viewBox: '0 0 16 16',
  stroke: 'currentColor',
  style: { display: 'block' },
};

const AlignLeftIcon: FunctionalComponent = () =>
  h('svg', { ...ICON_PROPS, fill: 'none' }, [
    h('path', {
      'stroke-linecap': 'square',
      'stroke-linejoin': 'round',
      d: 'M2.5 4.5h11m-11 7h9M2.5 8h5',
    }),
  ]);

const AlignCenterIcon: FunctionalComponent = () =>
  h('svg', ICON_PROPS, [
    h('path', {
      'stroke-linecap': 'square',
      'stroke-linejoin': 'round',
      d: 'M2.5 4.5h11m-10 7h9M5.5 8h5',
    }),
  ]);

const AlignRightIcon: FunctionalComponent = () =>
  h('svg', ICON_PROPS, [
    h('path', {
      'stroke-linecap': 'square',
      'stroke-linejoin': 'round',
      d: 'M2.5 4.5h11m-9 7h9M8.5 8h5',
    }),
  ]);
</script>

<template>
  <ToggleGroup
    aria-label="Text alignment"
    :default-value="['left']"
    class="flex gap-px p-px border border-neutral-950 dark:border-white"
  >
    <Toggle
      aria-label="Align left"
      value="left"
      class="flex size-8 items-center justify-center border-none rounded-none bg-transparent text-neutral-950 dark:text-white select-none hover:enabled:bg-neutral-100 dark:hover:enabled:bg-neutral-800 active:enabled:not-aria-pressed:bg-neutral-200 dark:active:enabled:not-aria-pressed:bg-neutral-700 aria-pressed:bg-neutral-950 aria-pressed:text-white dark:aria-pressed:bg-white dark:aria-pressed:text-neutral-950 aria-pressed:hover:enabled:bg-neutral-950 aria-pressed:hover:enabled:text-white dark:aria-pressed:hover:enabled:bg-white dark:aria-pressed:hover:enabled:text-neutral-950 focus-visible:relative focus-visible:z-1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
    >
      <AlignLeftIcon />
    </Toggle>
    <Toggle
      aria-label="Align center"
      value="center"
      class="flex size-8 items-center justify-center border-none rounded-none bg-transparent text-neutral-950 dark:text-white select-none hover:enabled:bg-neutral-100 dark:hover:enabled:bg-neutral-800 active:enabled:not-aria-pressed:bg-neutral-200 dark:active:enabled:not-aria-pressed:bg-neutral-700 aria-pressed:bg-neutral-950 aria-pressed:text-white dark:aria-pressed:bg-white dark:aria-pressed:text-neutral-950 aria-pressed:hover:enabled:bg-neutral-950 aria-pressed:hover:enabled:text-white dark:aria-pressed:hover:enabled:bg-white dark:aria-pressed:hover:enabled:text-neutral-950 focus-visible:relative focus-visible:z-1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
    >
      <AlignCenterIcon />
    </Toggle>
    <Toggle
      aria-label="Align right"
      value="right"
      class="flex size-8 items-center justify-center border-none rounded-none bg-transparent text-neutral-950 dark:text-white select-none hover:enabled:bg-neutral-100 dark:hover:enabled:bg-neutral-800 active:enabled:not-aria-pressed:bg-neutral-200 dark:active:enabled:not-aria-pressed:bg-neutral-700 aria-pressed:bg-neutral-950 aria-pressed:text-white dark:aria-pressed:bg-white dark:aria-pressed:text-neutral-950 aria-pressed:hover:enabled:bg-neutral-950 aria-pressed:hover:enabled:text-white dark:aria-pressed:hover:enabled:bg-white dark:aria-pressed:hover:enabled:text-neutral-950 focus-visible:relative focus-visible:z-1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
    >
      <AlignRightIcon />
    </Toggle>
  </ToggleGroup>
</template>
