<script setup lang="ts">
import { Menu } from '@vase-ui/vue/menu';
</script>

<template>
  <Menu.Root>
    <Menu.Trigger
      class="flex h-8 items-center justify-center rounded-md border border-neutral-950 bg-white px-3 text-sm text-neutral-950 select-none hover:bg-neutral-100 active:bg-neutral-200 data-pressed:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:bg-neutral-800 dark:active:bg-neutral-700 dark:data-pressed:bg-neutral-800 dark:focus-visible:outline-white"
    >
      Song
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner class="outline-hidden" :side-offset="8">
        <Transition enter-from-class="scale-95 opacity-0" leave-to-class="scale-95 opacity-0">
          <Menu.Popup
            class="origin-(--transform-origin) border border-neutral-950 bg-white py-1 text-neutral-950 outline-hidden transition dark:border-white dark:bg-neutral-950 dark:text-white"
          >
            <Menu.Item
              class="flex cursor-default py-2 pr-8 pl-4 text-sm leading-4 outline-hidden select-none data-highlighted:bg-neutral-950 data-highlighted:text-white dark:data-highlighted:bg-white dark:data-highlighted:text-neutral-950"
            >
              Add to Library
            </Menu.Item>
            <Menu.Item
              class="flex cursor-default py-2 pr-8 pl-4 text-sm leading-4 outline-hidden select-none data-highlighted:bg-neutral-950 data-highlighted:text-white dark:data-highlighted:bg-white dark:data-highlighted:text-neutral-950"
            >
              Add to Playlist
            </Menu.Item>
          </Menu.Popup>
        </Transition>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
</template>
