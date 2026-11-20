<script setup lang="ts">
import type { PropType } from 'vue';
import { Combobox } from '../../src/combobox';

// A clear button in a `<Transition>` that runs for 200 ms.
defineProps({ root: Object as PropType<Record<string, unknown>> });
</script>

<template>
  <Combobox.Root :items="['Apple', 'Banana']" v-bind="root">
    <Combobox.Input data-testid="input" />
    <Transition name="fade">
      <Combobox.Clear data-testid="clear" />
    </Transition>
  </Combobox.Root>
</template>

<style>
.fade-leave-active,
.fade-enter-active {
  transition: opacity 200ms;
}
.fade-leave-to,
.fade-enter-from {
  opacity: 0;
}
</style>
