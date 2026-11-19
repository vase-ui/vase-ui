<script setup lang="ts">
import { ScrollArea } from '@vase-ui/vue/scroll-area';
</script>

<template>
  <ScrollArea.Root class="group h-80 w-80 max-w-[calc(100vw-8rem)]">
    <ScrollArea.Viewport
      class="h-full border border-neutral-950 dark:border-white focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
    >
      <ScrollArea.Content class="pt-3 pr-6 pb-6 pl-3">
        <ul
          class="m-0 grid list-none grid-cols-[repeat(10,6.25rem)] grid-rows-[repeat(10,6.25rem)] gap-3 p-0"
        >
          <li
            v-for="i in 100"
            :key="i"
            class="flex items-center justify-center bg-neutral-200 dark:bg-neutral-800 text-sm font-bold text-neutral-600 dark:text-neutral-400"
          >
            {{ i }}
          </li>
        </ul>
      </ScrollArea.Content>
    </ScrollArea.Viewport>
    <ScrollArea.Scrollbar
      class="relative m-px flex bg-black/12 dark:bg-white/12 opacity-0 transition-opacity pointer-events-none data-[orientation=vertical]:w-4 data-[orientation=horizontal]:h-4 group-hover:pointer-events-auto group-hover:opacity-100 data-scrolling:pointer-events-auto data-scrolling:opacity-100 data-scrolling:duration-0"
    >
      <ScrollArea.Thumb class="w-full bg-neutral-950 dark:bg-white" />
    </ScrollArea.Scrollbar>
    <ScrollArea.Scrollbar
      class="relative m-px flex bg-black/12 dark:bg-white/12 opacity-0 transition-opacity pointer-events-none data-[orientation=vertical]:w-4 data-[orientation=horizontal]:h-4 group-hover:pointer-events-auto group-hover:opacity-100 data-scrolling:pointer-events-auto data-scrolling:opacity-100 data-scrolling:duration-0"
      orientation="horizontal"
    >
      <ScrollArea.Thumb class="w-full bg-neutral-950 dark:bg-white" />
    </ScrollArea.Scrollbar>
    <ScrollArea.Corner />
  </ScrollArea.Root>
</template>
