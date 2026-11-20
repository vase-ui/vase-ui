<script setup lang="ts">
import type { PropType } from 'vue';
import { Tooltip } from '../../src/tooltip';

// With `inRoot`, the part is in a root with no portal.
defineProps({
  part: { type: String as PropType<'Trigger' | 'Popup' | 'Positioner'>, required: true },
  inRoot: Boolean,
});
</script>

<template>
  <Tooltip.Root v-if="inRoot">
    <component :is="Tooltip[part]" />
  </Tooltip.Root>
  <component :is="Tooltip[part]" v-else />
</template>
