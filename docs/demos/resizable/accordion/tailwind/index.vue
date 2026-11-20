<script setup lang="ts">
import { onMounted, shallowRef, useTemplateRef } from 'vue';
import { Resizable } from '@vase-ui/vue/resizable';
import AccordionHeader from './AccordionHeader.vue';

const files = useTemplateRef('files');
const outline = useTemplateRef('outline');
const timeline = useTemplateRef('timeline');
// The panels get their sizes at the mount. The transition starts two frames later, so that it
// does not animate them.
const animated = shallowRef(false);
onMounted(() => requestAnimationFrame(() => requestAnimationFrame(() => (animated.value = true))));

function toggle(panel: { collapse(): void; expand(): void } | null, collapsed: boolean) {
  if (collapsed) panel?.expand();
  else panel?.collapse();
}
</script>

<template>
  <Resizable.Root
    orientation="vertical"
    class="h-64 box-border w-full overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800 [&[data-dragging]>*]:transition-none"
  >
    <Resizable.Panel
      id="files"
      ref="files"
      v-slot="{ state }"
      collapsible
      collapsed-size="40px"
      min-size="80px"
      :class="[
        'box-border overflow-hidden',
        animated && 'transition-[flex-grow] duration-200 ease-[ease] motion-reduce:transition-none',
      ]"
    >
      <AccordionHeader
        :expanded="!state.collapsed"
        controls="files"
        @toggle="toggle(files, state.collapsed)"
      >
        Files
      </AccordionHeader>
      <p class="px-4 text-sm text-neutral-600 dark:text-neutral-400">The pages of the project.</p>
    </Resizable.Panel>
    <Resizable.Handle
      aria-label="Resize the files"
      class="h-px flex-none cursor-row-resize pointer-coarse:[--resizable-handle-hit-area-size:24px] bg-neutral-200 outline-none focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 data-at-max:cursor-n-resize data-at-min:cursor-s-resize data-at-min:data-at-max:cursor-default aria-disabled:cursor-default dark:bg-neutral-800 dark:focus-visible:outline-white"
    />
    <Resizable.Panel
      id="outline"
      ref="outline"
      v-slot="{ state }"
      collapsible
      collapsed-size="40px"
      min-size="80px"
      :class="[
        'box-border overflow-hidden',
        animated && 'transition-[flex-grow] duration-200 ease-[ease] motion-reduce:transition-none',
      ]"
    >
      <AccordionHeader
        :expanded="!state.collapsed"
        controls="outline"
        @toggle="toggle(outline, state.collapsed)"
      >
        Outline
      </AccordionHeader>
      <p class="px-4 text-sm text-neutral-600 dark:text-neutral-400">The headings of the page.</p>
    </Resizable.Panel>
    <Resizable.Handle
      primary-panel="next"
      aria-label="Resize the timeline"
      class="h-px flex-none cursor-row-resize pointer-coarse:[--resizable-handle-hit-area-size:24px] bg-neutral-200 outline-none focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 data-at-max:cursor-n-resize data-at-min:cursor-s-resize data-at-min:data-at-max:cursor-default aria-disabled:cursor-default dark:bg-neutral-800 dark:focus-visible:outline-white"
    />
    <Resizable.Panel
      id="timeline"
      ref="timeline"
      v-slot="{ state }"
      collapsible
      collapsed-size="40px"
      min-size="80px"
      :class="[
        'box-border overflow-hidden',
        animated && 'transition-[flex-grow] duration-200 ease-[ease] motion-reduce:transition-none',
      ]"
    >
      <AccordionHeader
        :expanded="!state.collapsed"
        controls="timeline"
        @toggle="toggle(timeline, state.collapsed)"
      >
        Timeline
      </AccordionHeader>
      <p class="px-4 text-sm text-neutral-600 dark:text-neutral-400">The changes to the page.</p>
    </Resizable.Panel>
  </Resizable.Root>
</template>
