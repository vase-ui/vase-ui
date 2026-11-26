<script setup lang="ts">
import type { PropType } from 'vue';
import { Select } from '../../src/select';

// A select of 10 items that counts the renders of the trigger and the value with a call in their
// `element` slots.
defineProps({
  count: { type: Function as PropType<(part: string) => string>, required: true },
});
const ITEMS = Array.from({ length: 10 }, (_, index) => `Item ${index}`);
</script>

<template>
  <Select.Root>
    <Select.Trigger>
      <template #element="{ props, elementRef }">
        <button v-bind="props" :ref="elementRef" data-testid="trigger">
          {{ count('trigger') }}
          <Select.Value>
            <template #element="{ props: valueProps, elementRef: valueRef }">
              <span v-bind="valueProps" :ref="valueRef">{{ count('value') }}</span>
            </template>
          </Select.Value>
        </button>
      </template>
    </Select.Trigger>
    <Select.Portal>
      <Select.Positioner data-testid="positioner" :align-item-with-trigger="false">
        <Select.Popup data-testid="popup">
          {{ count('popup') }}
          <Select.Item v-for="item in ITEMS" :key="item" :value="item">{{ item }}</Select.Item>
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  </Select.Root>
</template>
