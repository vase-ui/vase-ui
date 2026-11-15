<script setup lang="ts">
import { defineComponent, h } from 'vue';
import * as Resizable from '../index.parts';

// A panel below a component with an async `setup` registers after the panels beside it.
const LatePanel = defineComponent({
  async setup() {
    await Promise.resolve();
    return () => h(Resizable.Panel, { id: 'late', 'data-testid': 'late' });
  },
});
</script>

<template>
  <Resizable.Root data-testid="root">
    <Resizable.Panel id="a" data-testid="a" />
    <Resizable.Handle data-testid="handle-a" aria-label="First" />
    <Resizable.Panel id="b" data-testid="b" />
    <Suspense>
      <LatePanel />
    </Suspense>
  </Resizable.Root>
</template>
