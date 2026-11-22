<script setup lang="ts">
import type { PropType } from 'vue';
import { Select } from '../../src/select';

// One part in an open root, outside the part that it needs: a group label with no group, an item
// text with no item, or a popup with no positioner.
defineProps({
  part: { type: String as PropType<'GroupLabel' | 'ItemText' | 'Popup'>, required: true },
});
</script>

<template>
  <Select.Root default-open>
    <Select.Trigger />
    <component :is="Select[part]" />
  </Select.Root>
</template>
