<script setup lang="ts">
import { Resizable } from '@vase-ui/vue/resizable';
import AccordionHeader from './AccordionHeader.vue';
</script>

<template>
  <Resizable.Root
    orientation="vertical"
    class="h-64 box-border w-full overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800 [&[data-dragging]>*]:transition-none"
  >
    <Resizable.Panel
      id="files"
      collapsible
      collapsed-size="40px"
      min-size="80px"
      class="box-border overflow-hidden transition-[flex-grow] duration-200 motion-reduce:transition-none"
    >
      <AccordionHeader>Files</AccordionHeader>
      <p class="px-4 text-sm text-neutral-600 dark:text-neutral-400">The pages of the project.</p>
    </Resizable.Panel>
    <Resizable.Handle
      aria-label="Resize the files"
      class="h-px flex-none cursor-row-resize bg-neutral-200 outline-none focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 data-at-max:cursor-n-resize data-at-min:cursor-s-resize data-at-min:data-at-max:cursor-default data-disabled:cursor-default dark:bg-neutral-800 dark:focus-visible:outline-white"
    />
    <Resizable.Panel
      id="outline"
      collapsible
      collapsed-size="40px"
      min-size="80px"
      class="box-border overflow-hidden transition-[flex-grow] duration-200 motion-reduce:transition-none"
    >
      <AccordionHeader>Outline</AccordionHeader>
      <p class="px-4 text-sm text-neutral-600 dark:text-neutral-400">The headings of the page.</p>
    </Resizable.Panel>
    <Resizable.Handle
      primary-panel="next"
      aria-label="Resize the timeline"
      class="h-px flex-none cursor-row-resize bg-neutral-200 outline-none focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 data-at-max:cursor-n-resize data-at-min:cursor-s-resize data-at-min:data-at-max:cursor-default data-disabled:cursor-default dark:bg-neutral-800 dark:focus-visible:outline-white"
    />
    <Resizable.Panel
      id="timeline"
      collapsible
      collapsed-size="40px"
      min-size="80px"
      class="box-border overflow-hidden transition-[flex-grow] duration-200 motion-reduce:transition-none"
    >
      <AccordionHeader>Timeline</AccordionHeader>
      <p class="px-4 text-sm text-neutral-600 dark:text-neutral-400">The changes to the page.</p>
    </Resizable.Panel>
  </Resizable.Root>
</template>
