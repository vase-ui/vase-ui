<script setup lang="ts">
import { Select } from '@vase-ui/vue/select';
</script>

<template>
  <Select.Root>
    <Select.Label />
    <Select.Trigger>
      <Select.Value />
      <Select.Icon />
    </Select.Trigger>

    <Select.Portal>
      <Select.Backdrop />
      <Select.Positioner>
        <Select.Popup>
          <Select.ScrollUpArrow />
          <Select.Arrow />
          <Select.List>
            <Select.Item>
              <Select.ItemText />
              <Select.ItemIndicator />
            </Select.Item>
            <Select.Separator />
            <Select.Group>
              <Select.GroupLabel />
            </Select.Group>
          </Select.List>
          <Select.ScrollDownArrow />
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  </Select.Root>
</template>
