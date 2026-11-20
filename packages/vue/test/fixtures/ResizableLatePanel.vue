<script setup lang="ts">
import { Resizable } from '../../src/resizable';
import ResizableAsyncPanel from './ResizableAsyncPanel.vue';
</script>

<template>
  <div style="width: 400px; height: 100px">
    <Resizable.Root style="height: 100%">
      <Resizable.Panel id="a" />
      <Resizable.Handle aria-label="Resize a" />
      <Resizable.Panel id="b" />
      <Suspense>
        <ResizableAsyncPanel />
      </Suspense>
    </Resizable.Root>
  </div>
</template>
