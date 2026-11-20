<script setup lang="ts">
import type { PropType } from 'vue';
import { Menu } from '../../src/menu';

// The part is in a root with no portal.
defineProps({
  part: { type: String as PropType<'Backdrop' | 'Positioner'>, required: true },
});
</script>

<template>
  <Menu.Root>
    <component :is="Menu[part]" />
  </Menu.Root>
</template>
