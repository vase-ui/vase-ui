<script setup lang="ts">
import { Resizable } from '@vase-ui/vue/resizable';
</script>

<template>
  <Resizable.Root drag-edges class="box-border h-48 w-full overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800 [&>[data-vase-ui-resizable-edge]]:cursor-col-resize [&>[data-vase-ui-resizable-edge]:hover]:bg-neutral-200 dark:[&>[data-vase-ui-resizable-edge]:hover]:bg-neutral-800">
    <Resizable.Panel id="navigation" default-size="25" class="box-border overflow-hidden p-4">
      <p class="text-sm font-medium text-neutral-950 dark:text-white">Navigation</p>
      <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Drag the line between two panels.</p>
    </Resizable.Panel>
    <Resizable.Panel id="editor" class="box-border overflow-hidden p-4 border-l border-neutral-200 dark:border-neutral-800">
      <p class="text-sm font-medium text-neutral-950 dark:text-white">Editor</p>
      <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">The panels have no handle.</p>
    </Resizable.Panel>
    <Resizable.Panel id="preview" default-size="25" class="box-border overflow-hidden p-4 border-l border-neutral-200 dark:border-neutral-800">
      <p class="text-sm font-medium text-neutral-950 dark:text-white">Preview</p>
      <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">A keyboard user needs a handle.</p>
    </Resizable.Panel>
  </Resizable.Root>
</template>
