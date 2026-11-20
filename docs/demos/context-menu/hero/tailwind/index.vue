<script setup lang="ts">
import { ContextMenu } from '@vase-ui/vue/context-menu';

const itemClass =
  "flex cursor-default py-2 pr-8 pl-4 text-sm leading-4 outline-hidden select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] aria-disabled:text-neutral-500 dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white dark:aria-disabled:text-neutral-400";

const popupHiddenClass = 'scale-[0.98] opacity-0';
</script>

<template>
  <ContextMenu.Root>
    <ContextMenu.Trigger
      class="flex aspect-5/3 w-full max-w-64 items-center justify-center rounded-none border border-neutral-950 bg-white text-neutral-950 select-none text-sm dark:border-white dark:bg-neutral-950 dark:text-white"
      >Right click here</ContextMenu.Trigger
    >
    <ContextMenu.Portal>
      <ContextMenu.Positioner class="outline-hidden">
        <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass" appear>
          <ContextMenu.Popup
            class="origin-[var(--transform-origin)] border border-neutral-950 bg-white py-1 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 outline-hidden transition-[scale,opacity] duration-100 ease-out dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
          >
            <ContextMenu.Item :class="itemClass">Add to Library</ContextMenu.Item>
            <ContextMenu.Item :class="itemClass">Add to Playlist</ContextMenu.Item>
            <ContextMenu.Separator class="mx-1 my-1 h-px bg-neutral-950 dark:bg-white" />
            <ContextMenu.Item :class="itemClass">Play Next</ContextMenu.Item>
            <ContextMenu.Item :class="itemClass">Play Last</ContextMenu.Item>
            <ContextMenu.Separator class="mx-1 my-1 h-px bg-neutral-950 dark:bg-white" />
            <ContextMenu.Item :class="itemClass">Favorite</ContextMenu.Item>
            <ContextMenu.Item :class="itemClass">Share</ContextMenu.Item>
          </ContextMenu.Popup>
        </Transition>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  </ContextMenu.Root>
</template>
