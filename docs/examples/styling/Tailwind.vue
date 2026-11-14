<script setup lang="ts">
import { Tooltip } from '@vase-ui/vue/tooltip';
</script>

<template>
  <Tooltip.Root>
    <Tooltip.Trigger
      class="flex h-8 items-center justify-center rounded-md border border-neutral-950 bg-white px-3 text-sm text-neutral-950 select-none hover:bg-neutral-100 active:bg-neutral-200 data-popup-open:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:bg-neutral-800 dark:active:bg-neutral-700 dark:data-popup-open:bg-neutral-800 dark:focus-visible:outline-white"
    >
      Song
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Positioner class="outline-hidden" :side-offset="8">
        <Tooltip.Popup
          class="origin-(--transform-origin) border border-neutral-950 bg-white px-4 py-2 text-sm text-neutral-950 outline-hidden transition data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 dark:border-white dark:bg-neutral-950 dark:text-white"
        >
          Add to Library
        </Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>
</template>
