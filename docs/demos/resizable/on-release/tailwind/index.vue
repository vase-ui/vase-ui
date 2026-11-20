<script setup lang="ts">
import { Resizable } from '@vase-ui/vue/resizable';
</script>

<template>
  <Resizable.Root
    resize-mode="on-release"
    class="box-border h-48 w-full overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800"
  >
    <Resizable.Panel id="navigation" default-size="30" class="box-border overflow-hidden p-4">
      <p class="text-sm font-medium text-neutral-950 dark:text-white">Navigation</p>
      <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        A drag shows a line, and the panels change at the release.
      </p>
    </Resizable.Panel>
    <Resizable.Handle
      aria-label="Resize the navigation"
      class="w-px flex-none cursor-col-resize pointer-coarse:[--resizable-handle-hit-area-size:24px] bg-neutral-200 outline-none focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 data-at-max:cursor-w-resize data-at-min:cursor-e-resize data-at-min:data-at-max:cursor-default after:absolute after:inset-0 after:hidden after:translate-x-(--resizable-handle-preview-offset) after:bg-neutral-950 data-dragging:after:block dark:after:bg-white aria-disabled:cursor-default dark:bg-neutral-800 dark:focus-visible:outline-white"
    />
    <Resizable.Panel id="editor" class="box-border overflow-hidden p-4">
      <p class="text-sm font-medium text-neutral-950 dark:text-white">Editor</p>
      <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">The code of the page.</p>
    </Resizable.Panel>
  </Resizable.Root>
</template>
