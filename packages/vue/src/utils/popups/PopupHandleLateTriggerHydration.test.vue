<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import type { Component } from 'vue';
import { Menu } from '@vase-ui/vue/menu';

const props = defineProps<{
  handle?: Menu.Handle<unknown> | undefined;
  hydrationGate?: Promise<void> | undefined;
}>();

// The server receives props as JSON, so it needs its own handle.
const menuHandle = props.handle ?? Menu.createHandle();
const LateTrigger = defineAsyncComponent(async () => {
  await props.hydrationGate;
  // The loader type does not accept a generic SFC.
  return Menu.Trigger as unknown as Component;
});

function stateClass(state: Menu.Trigger.State) {
  return state.disabled ? 'off' : 'on';
}
</script>

<template>
  <Menu.Root :handle="menuHandle" disabled />
  <Suspense>
    <LateTrigger id="trigger" :handle="menuHandle" :state-class="stateClass">Trigger</LateTrigger>
    <template #fallback>Loading</template>
  </Suspense>
</template>
