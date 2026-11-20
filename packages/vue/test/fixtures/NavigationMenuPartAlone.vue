<script setup lang="ts">
import type { PropType } from 'vue';
import { NavigationMenu } from '../../src/navigation-menu';

// With `inRoot`, the part is in a root with no item and no portal.
defineProps({
  part: { type: String as PropType<'List' | 'Icon' | 'Positioner' | 'Arrow'>, required: true },
  inRoot: Boolean,
});
</script>

<template>
  <NavigationMenu.Root v-if="inRoot">
    <component :is="NavigationMenu[part]" />
  </NavigationMenu.Root>
  <component :is="NavigationMenu[part]" v-else />
</template>
