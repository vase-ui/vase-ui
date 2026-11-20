<script setup lang="ts">
import { defineAsyncComponent, type Component, type PropType } from 'vue';
import { Dialog } from '../../src/dialog';

// A root with a handle, open at the mount, and a trigger with that handle in a `<Suspense>`. The
// trigger hydrates after the root, when `gate` resolves.
const props = defineProps({
  // A server render gets its props as JSON, so it gets no handle.
  handle: {
    type: Object as PropType<InstanceType<typeof Dialog.Handle>>,
    default: () => Dialog.createHandle(),
  },
  gate: Promise as PropType<Promise<void>>,
});
// The type of `defineAsyncComponent` does not take a generic SFC.
const LateTrigger = defineAsyncComponent(async () => {
  await props.gate;
  return Dialog.Trigger as unknown as Component;
});
</script>

<template>
  <Dialog.Root :handle default-open :modal="false">
    <Dialog.Portal>
      <Dialog.Popup data-testid="popup">Dialog</Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
  <Suspense>
    <LateTrigger :handle id="trigger">Trigger</LateTrigger>
  </Suspense>
</template>
