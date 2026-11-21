<script setup lang="ts">
import { Select } from '../../src/select';

// A select whose popup renders its own `<div>` in the `element` slot, with a heading before its
// list. The trigger has the room for the popup over it.
</script>

<template>
  <Select.Root default-value="banana">
    <Select.Trigger data-testid="trigger" style="margin-top: 200px">
      <Select.Value data-testid="value" />
    </Select.Trigger>
    <Select.Portal>
      <Select.Positioner data-testid="positioner">
        <Select.Popup>
          <template #element="{ props, elementRef }">
            <div v-bind="props" :ref="elementRef" data-testid="popup">
              <p>Fruits</p>
              <Select.List>
                <Select.Item value="apple"><Select.ItemText>Apple</Select.ItemText></Select.Item>
                <Select.Item value="banana"><Select.ItemText>Banana</Select.ItemText></Select.Item>
              </Select.List>
            </div>
          </template>
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  </Select.Root>
</template>
