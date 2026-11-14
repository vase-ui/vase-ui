<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import type { Component } from 'vue';
import * as Tooltip from '../index.parts';

const props = defineProps<{
  handle?: Tooltip.Handle<unknown> | undefined;
  hydrationGate?: Promise<void> | undefined;
}>();

// A server render gets no handle, because the props go to the server as JSON.
const tooltipHandle = props.handle ?? Tooltip.createHandle();
// The trigger in `<Suspense>` hydrates after its root, when the gate resolves. The type of
// `defineAsyncComponent` does not accept a generic SFC.
const DelayedTrigger = defineAsyncComponent(async () => {
  await props.hydrationGate;
  return Tooltip.Trigger as unknown as Component;
});
</script>

<template>
  <Tooltip.Root :handle="tooltipHandle" default-open default-trigger-id="trigger" />
  <Suspense>
    <DelayedTrigger :handle="tooltipHandle" id="trigger">Trigger</DelayedTrigger>
    <template #fallback>Loading</template>
  </Suspense>
</template>
