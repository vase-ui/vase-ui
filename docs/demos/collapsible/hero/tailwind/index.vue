<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Collapsible } from '@vase-ui/vue/collapsible';

const CaretRightIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      width: '16',
      height: '16',
      viewBox: '0 0 16 16',
      fill: 'currentColor',
      style: { display: 'block' },
    },
    [h('path', { d: 'M6 12V4l4.5 4z' })],
  );

// The panel animates its height from 0 to the height of its content, and back.
const enterFromClass = 'h-0';
const enterToClass = 'h-[var(--collapsible-panel-height)]';
const leaveFromClass = 'h-[var(--collapsible-panel-height)]';
const leaveToClass = 'h-0';
const panelTransition = { enterFromClass, enterToClass, leaveFromClass, leaveToClass };
</script>

<template>
  <Collapsible.Root
    class="flex min-h-36 w-48 flex-col justify-center text-neutral-950 dark:text-white"
  >
    <Collapsible.Trigger
      class="group flex h-8 items-center justify-between gap-2 rounded-none border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 pl-3 pr-2 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 dark:text-white select-none hover:not-disabled:bg-neutral-100 dark:hover:not-disabled:bg-neutral-800 active:not-disabled:bg-neutral-200 dark:active:not-disabled:bg-neutral-700 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white disabled:border-neutral-500 disabled:text-neutral-500 dark:disabled:border-neutral-400 dark:disabled:text-neutral-400"
    >
      Recovery keys
      <CaretRightIcon
        class="transition-transform duration-100 ease-[ease-out] group-aria-expanded:rotate-90"
      />
    </Collapsible.Trigger>
    <Transition v-bind="panelTransition">
      <Collapsible.Panel
        class="flex flex-col justify-end overflow-hidden text-sm transition-[height] duration-150 ease-[ease-out]"
      >
        <div class="flex flex-col gap-2 px-3.5 py-2">
          <div>alien-bean-pasta</div>
          <div>wild-irish-burrito</div>
          <div>horse-battery-staple</div>
        </div>
      </Collapsible.Panel>
    </Transition>
  </Collapsible.Root>
</template>
