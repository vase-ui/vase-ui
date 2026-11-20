<script setup lang="ts">
import type { PropType } from 'vue';
import { Dialog } from '../../src/dialog';
import MeasureHookWait from './MeasureHookWait.vue';

// A page with a dialog root that has the handle. With `gate`, the page waits for it in a
// `<Suspense>`.
defineProps({
  name: { type: String, required: true },
  handle: { type: Object as PropType<InstanceType<typeof Dialog.Handle>>, required: true },
  gate: Promise as PropType<Promise<void>>,
});
</script>

<template>
  <Dialog.Root :handle>
    <Dialog.Portal>
      <Dialog.Popup :data-testid="`popup-${name}`">{{ name }}</Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
  <MeasureHookWait v-if="gate" :gate />
</template>
