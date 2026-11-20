<script setup lang="ts">
import type { PropType } from 'vue';
import { Popover } from '../../src/popover';

// With `inRoot`, the part is in a root with no portal.
defineProps({
  part: { type: String as PropType<'Trigger' | 'Popup' | 'Positioner'>, required: true },
  inRoot: Boolean,
});
</script>

<template>
  <Popover.Root v-if="inRoot">
    <component :is="Popover[part]" />
  </Popover.Root>
  <component :is="Popover[part]" v-else />
</template>
