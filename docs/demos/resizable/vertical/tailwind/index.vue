<script setup lang="ts">
import { Resizable } from '@vase-ui/vue/resizable';
</script>

<template>
  <Resizable.Root
    orientation="vertical"
    class="box-border h-48 w-full overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800"
  >
    <Resizable.Panel id="editor" class="box-border overflow-hidden p-4">
      <p class="text-sm font-medium text-neutral-950 dark:text-white">Editor</p>
      <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">The code of the page.</p>
    </Resizable.Panel>
    <Resizable.Handle
      primary-panel="next"
      aria-label="Resize the terminal"
      class="h-px flex-none cursor-row-resize pointer-coarse:[--resizable-handle-hit-area-size:24px] bg-neutral-200 outline-none focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 data-at-max:cursor-n-resize data-at-min:cursor-s-resize data-at-min:data-at-max:cursor-default aria-disabled:cursor-default dark:bg-neutral-800 dark:focus-visible:outline-white"
    />
    <Resizable.Panel
      id="terminal"
      default-size="30"
      min-size="20"
      class="box-border overflow-hidden p-4"
    >
      <p class="text-sm font-medium text-neutral-950 dark:text-white">Terminal</p>
      <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">The output of the build.</p>
    </Resizable.Panel>
  </Resizable.Root>
</template>
