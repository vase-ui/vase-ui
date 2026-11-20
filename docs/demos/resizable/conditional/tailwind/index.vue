<script setup lang="ts">
import { shallowRef } from 'vue';
import { Resizable } from '@vase-ui/vue/resizable';

const showPreview = shallowRef(false);
</script>

<template>
  <div class="flex w-full flex-col gap-3">
    <label class="flex items-center gap-2 text-sm text-neutral-950 dark:text-white">
      <input v-model="showPreview" type="checkbox" />
      Show the preview
    </label>
    <Resizable.Root
      class="box-border h-48 w-full overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800"
    >
      <Resizable.Panel id="editor" class="box-border overflow-hidden p-4">
        <p class="text-sm font-medium text-neutral-950 dark:text-white">Editor</p>
        <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">The code of the page.</p>
      </Resizable.Panel>
      <template v-if="showPreview">
        <Resizable.Handle
          primary-panel="next"
          aria-label="Resize the preview"
          class="w-px flex-none cursor-col-resize pointer-coarse:[--resizable-handle-hit-area-size:24px] bg-neutral-200 outline-none focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 data-at-max:cursor-w-resize data-at-min:cursor-e-resize data-at-min:data-at-max:cursor-default aria-disabled:cursor-default dark:bg-neutral-800 dark:focus-visible:outline-white"
        />
        <Resizable.Panel id="preview" default-size="40" class="box-border overflow-hidden p-4">
          <p class="text-sm font-medium text-neutral-950 dark:text-white">Preview</p>
          <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            The root gives room to this panel when it mounts.
          </p>
        </Resizable.Panel>
      </template>
    </Resizable.Root>
  </div>
</template>
