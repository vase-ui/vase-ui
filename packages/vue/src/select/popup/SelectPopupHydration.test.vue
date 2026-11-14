<script setup lang="ts">
import { Select } from '@vase-ui/vue/select';
</script>

<template>
  <Select.Root default-open default-value="a">
    <Select.Trigger>
      <Select.Value />
    </Select.Trigger>
    <Select.Positioner>
      <Select.Popup data-testid="popup">
        <Select.Item value="a">a</Select.Item>
        <Select.Item value="b">b</Select.Item>
      </Select.Popup>
    </Select.Positioner>
  </Select.Root>
</template>
