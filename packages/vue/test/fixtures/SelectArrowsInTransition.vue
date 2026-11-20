<script setup lang="ts">
import { Select } from '../../src/select';

const items = Array.from({ length: 30 }, (_, index) => `Item ${index}`);
</script>

<!-- A select whose scroll arrows are in a `<Transition>` of 200 ms. -->
<template>
  <Select.Root default-open>
    <Select.Trigger data-testid="trigger"><Select.Value /></Select.Trigger>
    <Select.Portal>
      <Select.Positioner data-testid="positioner" :align-item-with-trigger="false">
        <Select.Popup data-testid="popup" style="max-height: 120px; overflow-y: auto">
          <Transition>
            <Select.ScrollDownArrow class="down" />
          </Transition>
          <Select.Item v-for="item in items" :key="item" :value="item">{{ item }}</Select.Item>
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  </Select.Root>
</template>

<style>
.v-enter-active,
.v-leave-active {
  transition: opacity 200ms;
}
.v-enter-from,
.v-leave-to {
  opacity: 0;
}
</style>
