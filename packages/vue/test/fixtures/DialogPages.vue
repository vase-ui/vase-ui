<script setup lang="ts">
import type { PropType } from 'vue';
import { Dialog } from '../../src/dialog';
import DialogPage from './DialogPage.vue';

// One page at a time in a `<Suspense>`, as a page of Nuxt, and a trigger outside the pages. Each
// page has a root with the same handle.
defineProps({
  handle: { type: Object as PropType<InstanceType<typeof Dialog.Handle>>, required: true },
  scene: { type: Object as PropType<{ page: string }>, required: true },
  gates: { type: Object as PropType<Record<string, Promise<void>>>, default: () => ({}) },
});
</script>

<template>
  <Dialog.Trigger :handle>Open</Dialog.Trigger>
  <Suspense>
    <DialogPage :key="scene.page" :name="scene.page" :handle :gate="gates[scene.page]" />
  </Suspense>
</template>
