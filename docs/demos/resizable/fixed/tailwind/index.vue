<script setup lang="ts">
import { ref } from 'vue';
import { Resizable, type ResizableLayout } from '@vase-ui/vue/resizable';

// The layout has the width of the navigation in pixels.
const layout = ref<ResizableLayout>({});
</script>

<template>
  <Resizable.Root
    v-model="layout"
    class="box-border h-48 w-full overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800"
  >
    <Resizable.Panel
      id="navigation"
      default-size="240px"
      min-size="10rem"
      max-size="50vw"
      root-resize-behavior="fixed"
      class="box-border overflow-hidden p-4"
    >
      <p class="text-sm font-medium text-neutral-950 dark:text-white">Navigation</p>
      <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Resize the window: the navigation keeps its width.
      </p>
    </Resizable.Panel>
    <Resizable.Handle
      aria-label="Resize the navigation"
      class="w-px flex-none cursor-col-resize pointer-coarse:[--resizable-handle-hit-area-size:24px] bg-neutral-200 outline-none focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 data-at-max:cursor-w-resize data-at-min:cursor-e-resize data-at-min:data-at-max:cursor-default aria-disabled:cursor-default dark:bg-neutral-800 dark:focus-visible:outline-white"
    />
    <Resizable.Panel id="editor" class="box-border overflow-hidden p-4">
      <p class="text-sm font-medium text-neutral-950 dark:text-white">Editor</p>
      <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        The editor takes the rest of the width.
      </p>
      <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        The layout: {{ JSON.stringify(layout) }}
      </p>
    </Resizable.Panel>
  </Resizable.Root>
</template>
