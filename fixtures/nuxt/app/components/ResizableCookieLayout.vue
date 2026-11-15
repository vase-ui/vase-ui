<script setup lang="ts">
import { useCookie } from '#imports';
import { Resizable } from '@vase-ui/vue/resizable';
import type {
  ResizableRootCommitEventDetails,
  ResizableRootLayout,
  ResizableRootLayoutSnapshot,
} from '@vase-ui/vue/resizable';

const saved = useCookie<ResizableRootLayoutSnapshot | undefined>('resizable-layout');
// The root reads its default layout one time, at the start.
const defaultLayout = saved.value ?? { 'c-a': 25, 'c-b': 75 };

// The snapshot has the pixels of the fixed panel, so it keeps its width at the next visit.
function save(_layout: ResizableRootLayout, details: ResizableRootCommitEventDetails) {
  saved.value = details.snapshot;
}
</script>

<template>
  <Resizable.Root
    :default-layout="defaultLayout"
    data-testid="cookie"
    style="width: 600px; height: 80px"
    @layout-committed="save"
  >
    <Resizable.Panel id="c-a" data-testid="c-a" root-resize-behavior="fixed" />
    <Resizable.Handle
      data-testid="cookie-handle"
      aria-label="Resize the first panel"
      style="width: 0"
    />
    <Resizable.Panel id="c-b" data-testid="c-b" />
  </Resizable.Root>
</template>
