<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import type { Component } from 'vue';
import { Dialog } from '@vase-ui/vue/dialog';

const props = defineProps<{
  handle?: Dialog.Handle<unknown> | undefined;
  hydrationGate?: Promise<void> | undefined;
}>();

// A server render gets no handle, because the props go to the server as JSON.
const dialogHandle = props.handle ?? Dialog.createHandle();
// The trigger in `<Suspense>` hydrates after its root, when the gate resolves. The type of
// `defineAsyncComponent` does not accept a generic SFC.
const DelayedTrigger = defineAsyncComponent(async () => {
  await props.hydrationGate;
  return Dialog.Trigger as unknown as Component;
});
</script>

<template>
  <Dialog.Root :handle="dialogHandle" default-open default-trigger-id="trigger" />
  <Suspense>
    <DelayedTrigger :handle="dialogHandle" id="trigger">Trigger</DelayedTrigger>
    <template #fallback>Loading</template>
  </Suspense>
</template>
