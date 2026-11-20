<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Menu } from '@vase-ui/vue/menu';

const CaretDownIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      width: '16',
      height: '16',
      viewBox: '0 0 16 16',
      fill: 'currentColor',
      style: { display: 'block' },
    },
    [h('path', { d: 'M12 6H4l4 4.5z' })],
  );

const itemClass =
  "flex cursor-default py-2 pr-8 pl-4 text-sm leading-4 outline-hidden select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] aria-disabled:text-neutral-500 dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white dark:aria-disabled:text-neutral-400";

const popupHiddenClass = 'scale-[0.98] opacity-0';
</script>

<template>
  <Menu.Root>
    <Menu.Trigger
      open-on-hover
      class="flex h-8 items-center justify-center gap-1.5 rounded-none border border-neutral-950 bg-white pl-3 pr-2 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:not-disabled:bg-neutral-100 active:not-disabled:bg-neutral-200 data-pressed:bg-neutral-100 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-disabled:bg-neutral-800 dark:active:not-disabled:bg-neutral-700 disabled:border-neutral-500 disabled:text-neutral-500 dark:disabled:border-neutral-400 dark:disabled:text-neutral-400 dark:data-pressed:bg-neutral-800 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
    >
      Add to playlist
      <CaretDownIcon />
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner class="outline-hidden" :side-offset="8" align="start">
        <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass" appear>
          <Menu.Popup
            class="relative origin-[var(--transform-origin)] border border-neutral-950 bg-white py-1 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 outline-hidden transition-[scale,opacity] duration-100 ease-out dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
          >
            <Menu.Item :class="itemClass">Get Up!</Menu.Item>
            <Menu.Item :class="itemClass">Inside Out</Menu.Item>
            <Menu.Item :class="itemClass">Night Beats</Menu.Item>
            <Menu.Separator class="mx-1 my-1 h-px bg-neutral-950 dark:bg-white" />
            <Menu.Item :class="itemClass">New playlist…</Menu.Item>
          </Menu.Popup>
        </Transition>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
</template>
