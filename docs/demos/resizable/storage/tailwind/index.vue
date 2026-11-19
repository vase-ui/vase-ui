<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Resizable, type ResizableLayout } from '@vase-ui/vue/resizable';

const key = 'vase-ui-docs-resizable';
const layout = ref<ResizableLayout>({});

// A server has no storage, so the page reads it after the mount. A browser that blocks the data
// of the site throws. The root ignores an entry that is not a size.
onMounted(() => {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? '{}');
    if (saved !== null && typeof saved === 'object') layout.value = saved as ResizableLayout;
  } catch {
    layout.value = {};
  }
});

// One commit comes for each change of the user.
function save(committed: ResizableLayout) {
  try {
    localStorage.setItem(key, JSON.stringify(committed));
  } catch {
    // The layout stays for this visit only.
  }
}
</script>

<template>
  <Resizable.Root
    v-model="layout"
    class="box-border h-48 w-full overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800"
    @layout-committed="save"
  >
    <Resizable.Panel id="navigation" default-size="30" class="box-border overflow-hidden p-4">
      <p class="text-sm font-medium text-neutral-950 dark:text-white">Navigation</p>
      <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Resize the panels, then load the page again.
      </p>
    </Resizable.Panel>
    <Resizable.Handle
      aria-label="Resize the navigation"
      class="w-px flex-none cursor-col-resize pointer-coarse:[--resizable-handle-hit-area-size:24px] bg-neutral-200 outline-none focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 data-at-max:cursor-w-resize data-at-min:cursor-e-resize data-at-min:data-at-max:cursor-default aria-disabled:cursor-default dark:bg-neutral-800 dark:focus-visible:outline-white"
    />
    <Resizable.Panel id="editor" class="box-border overflow-hidden p-4">
      <p class="text-sm font-medium text-neutral-950 dark:text-white">Editor</p>
      <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        The layout stays in the storage of the browser.
      </p>
    </Resizable.Panel>
  </Resizable.Root>
</template>
