<script setup lang="ts">
import { Resizable } from '@vase-ui/vue/resizable';
</script>

<template>
  <Resizable.Root
    class="box-border h-48 w-full overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800"
  >
    <Resizable.Panel id="navigation" default-size="30" class="box-border overflow-hidden p-4">
      <p class="text-sm font-medium text-neutral-950 dark:text-white">Navigation</p>
      <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">The pages of the project.</p>
    </Resizable.Panel>
    <Resizable.Handle
      aria-label="Resize the navigation"
      class="w-px flex-none cursor-col-resize pointer-coarse:[--resizable-handle-hit-area-size:24px] bg-neutral-200 outline-none focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 data-at-max:cursor-w-resize data-at-min:cursor-e-resize data-at-min:data-at-max:cursor-default data-crossing:cursor-move data-at-min:data-at-max:data-crossing:cursor-move aria-disabled:cursor-default dark:bg-neutral-800 dark:focus-visible:outline-white"
    />
    <Resizable.Panel id="main" class="overflow-hidden">
      <Resizable.Root orientation="vertical" class="h-full">
        <Resizable.Panel id="editor" class="box-border overflow-hidden p-4">
          <p class="text-sm font-medium text-neutral-950 dark:text-white">Editor</p>
          <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Press at the crossing to move both handles.
          </p>
        </Resizable.Panel>
        <Resizable.Handle
          primary-panel="next"
          aria-label="Resize the terminal"
          class="h-px flex-none cursor-row-resize pointer-coarse:[--resizable-handle-hit-area-size:24px] bg-neutral-200 outline-none focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 data-at-max:cursor-n-resize data-at-min:cursor-s-resize data-at-min:data-at-max:cursor-default data-crossing:cursor-move data-at-min:data-at-max:data-crossing:cursor-move aria-disabled:cursor-default dark:bg-neutral-800 dark:focus-visible:outline-white"
        />
        <Resizable.Panel id="terminal" default-size="35" class="box-border overflow-hidden p-4">
          <p class="text-sm font-medium text-neutral-950 dark:text-white">Terminal</p>
          <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            The output of the build.
          </p>
        </Resizable.Panel>
      </Resizable.Root>
    </Resizable.Panel>
  </Resizable.Root>
</template>
