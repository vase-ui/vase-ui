<script setup lang="ts">
import { Select } from '@vase-ui/vue/select';
import { options } from '../../harness/options.ts';
</script>

<template>
  <Select.Root>
    <Select.Label>Label</Select.Label>
    <Select.Trigger data-bench="trigger">
      <Select.Value />
    </Select.Trigger>
    <Select.Portal>
      <Select.Positioner>
        <Select.Popup data-bench="popup">
          <Select.List>
            <Select.Item v-for="option in options" :key="option" :value="option">
              <Select.ItemText>{{ option }}</Select.ItemText>
            </Select.Item>
          </Select.List>
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  </Select.Root>
</template>
