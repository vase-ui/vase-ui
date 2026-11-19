<script setup lang="ts">
import { onMounted, shallowRef, useTemplateRef } from 'vue';
import { Resizable } from '@vase-ui/vue/resizable';
import CollapseButton from './CollapseButton.vue';

const sidebar = useTemplateRef('sidebar');
// The panels get their sizes at the mount. The transition starts two frames later, so that it
// does not animate them.
const animated = shallowRef(false);
onMounted(() => requestAnimationFrame(() => requestAnimationFrame(() => (animated.value = true))));

function toggle(collapsed: boolean) {
  if (collapsed) sidebar.value?.expand();
  else sidebar.value?.collapse();
}
</script>

<template>
  <Resizable.Root
    class="h-48 box-border w-full overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800 [&[data-dragging]>*]:transition-none"
  >
    <Resizable.Panel
      id="sidebar"
      ref="sidebar"
      v-slot="{ state }"
      default-size="30"
      min-size="160px"
      collapsible
      collapsed-size="48px"
      :class="[
        'box-border overflow-hidden whitespace-nowrap',
        animated && 'transition-[flex-grow] duration-200 ease-[ease] motion-reduce:transition-none',
      ]"
    >
      <div class="flex items-center gap-2 p-2">
        <CollapseButton
          :collapsed="state.collapsed"
          controls="sidebar"
          @toggle="toggle(state.collapsed)"
        />
        <p class="text-sm font-medium text-neutral-950 dark:text-white">Sidebar</p>
      </div>
    </Resizable.Panel>
    <Resizable.Handle
      aria-label="Resize the sidebar"
      class="w-px flex-none cursor-col-resize pointer-coarse:[--resizable-handle-hit-area-size:24px] bg-neutral-200 outline-none focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 data-at-max:cursor-w-resize data-at-min:cursor-e-resize data-at-min:data-at-max:cursor-default aria-disabled:cursor-default dark:bg-neutral-800 dark:focus-visible:outline-white"
    />
    <Resizable.Panel id="main" class="box-border overflow-hidden p-4">
      <p class="text-sm font-medium text-neutral-950 dark:text-white">Main</p>
      <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Drag the handle to the left, or press Enter on it.
      </p>
    </Resizable.Panel>
  </Resizable.Root>
</template>
