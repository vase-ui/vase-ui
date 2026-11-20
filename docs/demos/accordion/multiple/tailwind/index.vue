<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Accordion } from '@vase-ui/vue/accordion';

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

// The panel animates its height from 0 to the height of its content, and back.
const panelTransition = {
  enterFromClass: 'h-0',
  enterToClass: 'h-[var(--accordion-panel-height)]',
  leaveFromClass: 'h-[var(--accordion-panel-height)]',
  leaveToClass: 'h-0',
};
</script>

<template>
  <Accordion.Root
    class="flex w-full max-w-80 flex-col border border-neutral-950 text-neutral-950 dark:border-white dark:text-white"
    multiple
  >
    <Accordion.Item>
      <Accordion.Header>
        <Accordion.Trigger
          class="group flex w-full items-center justify-between gap-4 bg-transparent px-3 py-2 text-left text-sm font-normal text-neutral-950 select-none hover:not-disabled:bg-neutral-100 focus-visible:relative focus-visible:z-1 focus-visible:outline-2 focus-visible:outline-neutral-950 dark:focus-visible:outline-white dark:text-white dark:hover:not-disabled:bg-neutral-800"
        >
          What is Vase UI?
          <PlusIcon
            class="shrink-0 transition-transform duration-100 ease-[ease-out] group-aria-expanded:rotate-45"
          />
        </Accordion.Trigger>
      </Accordion.Header>
      <Transition v-bind="panelTransition">
        <Accordion.Panel
          class="overflow-hidden text-sm transition-[height] duration-150 ease-[ease-out]"
        >
          <div class="px-3 py-2">
            Vase UI is a library of unstyled, accessible Vue components for design systems and web
            apps.
          </div>
        </Accordion.Panel>
      </Transition>
    </Accordion.Item>

    <Accordion.Item class="border-t border-neutral-950 dark:border-white">
      <Accordion.Header>
        <Accordion.Trigger
          class="group flex w-full items-center justify-between gap-4 bg-transparent px-3 py-2 text-left text-sm font-normal text-neutral-950 select-none hover:not-disabled:bg-neutral-100 focus-visible:relative focus-visible:z-1 focus-visible:outline-2 focus-visible:outline-neutral-950 dark:focus-visible:outline-white dark:text-white dark:hover:not-disabled:bg-neutral-800"
        >
          How do I get started?
          <PlusIcon
            class="shrink-0 transition-transform duration-100 ease-[ease-out] group-aria-expanded:rotate-45"
          />
        </Accordion.Trigger>
      </Accordion.Header>
      <Transition v-bind="panelTransition">
        <Accordion.Panel
          class="overflow-hidden text-sm transition-[height] duration-150 ease-[ease-out]"
        >
          <div class="px-3 py-2">
            Head to the “Quick start” guide in the docs. If you’ve used unstyled libraries before,
            you’ll feel at home.
          </div>
        </Accordion.Panel>
      </Transition>
    </Accordion.Item>

    <Accordion.Item class="border-t border-neutral-950 dark:border-white">
      <Accordion.Header>
        <Accordion.Trigger
          class="group flex w-full items-center justify-between gap-4 bg-transparent px-3 py-2 text-left text-sm font-normal text-neutral-950 select-none hover:not-disabled:bg-neutral-100 focus-visible:relative focus-visible:z-1 focus-visible:outline-2 focus-visible:outline-neutral-950 dark:focus-visible:outline-white dark:text-white dark:hover:not-disabled:bg-neutral-800"
        >
          Can I use it for my project?
          <PlusIcon
            class="shrink-0 transition-transform duration-100 ease-[ease-out] group-aria-expanded:rotate-45"
          />
        </Accordion.Trigger>
      </Accordion.Header>
      <Transition v-bind="panelTransition">
        <Accordion.Panel
          class="overflow-hidden text-sm transition-[height] duration-150 ease-[ease-out]"
        >
          <div class="px-3 py-2">Yes. Vase UI is free and open source.</div>
        </Accordion.Panel>
      </Transition>
    </Accordion.Item>
  </Accordion.Root>
</template>
