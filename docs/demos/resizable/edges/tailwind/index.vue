<script setup lang="ts">
import { Resizable } from '@vase-ui/vue/resizable';
</script>

<template>
  <Resizable.Root
    class="box-border h-48 w-full overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800"
  >
    <Resizable.Panel id="navigation" default-size="25" class="box-border overflow-hidden p-4">
      <p class="text-sm font-medium text-neutral-950 dark:text-white">Navigation</p>
      <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Drag the line between two panels.
      </p>
    </Resizable.Panel>
    <Resizable.Handle
      aria-label="Resize the navigation"
      class="w-0 flex-none cursor-col-resize pointer-coarse:[--resizable-handle-hit-area-size:24px] outline-none focus-visible:outline-2 focus-visible:outline-neutral-950 data-at-max:cursor-w-resize data-at-min:cursor-e-resize data-at-min:data-at-max:cursor-default aria-disabled:cursor-default dark:focus-visible:outline-white"
    />
    <Resizable.Panel
      id="editor"
      class="box-border overflow-hidden p-4 border-l border-neutral-200 dark:border-neutral-800"
    >
      <p class="text-sm font-medium text-neutral-950 dark:text-white">Editor</p>
      <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Each handle has no size.</p>
    </Resizable.Panel>
    <Resizable.Handle
      primary-panel="next"
      aria-label="Resize the preview"
      class="w-0 flex-none cursor-col-resize pointer-coarse:[--resizable-handle-hit-area-size:24px] outline-none focus-visible:outline-2 focus-visible:outline-neutral-950 data-at-max:cursor-w-resize data-at-min:cursor-e-resize data-at-min:data-at-max:cursor-default aria-disabled:cursor-default dark:focus-visible:outline-white"
    />
    <Resizable.Panel
      id="preview"
      default-size="25"
      class="box-border overflow-hidden p-4 border-l border-neutral-200 dark:border-neutral-800"
    >
      <p class="text-sm font-medium text-neutral-950 dark:text-white">Preview</p>
      <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Its pointer target takes the press.
      </p>
    </Resizable.Panel>
  </Resizable.Root>
</template>
