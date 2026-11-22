<script setup lang="ts">
import { Select } from '../../src/select';
import { Toolbar } from '../../src/toolbar';
</script>

<!-- A toolbar whose first item is the trigger of a select, with the popup in the toolbar. -->
<template>
  <Toolbar.Root>
    <Select.Root default-value="a">
      <Select.Trigger :as="Toolbar.Button" data-testid="trigger"><Select.Value /></Select.Trigger>
      <Select.Portal disabled>
        <Select.Positioner :align-item-with-trigger="false">
          <Select.Popup data-testid="popup">
            <Select.Item value="a" data-testid="item-a">a</Select.Item>
            <Select.Item value="b" data-testid="item-b">b</Select.Item>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
    <Toolbar.Button data-testid="next">Next</Toolbar.Button>
  </Toolbar.Root>
</template>
