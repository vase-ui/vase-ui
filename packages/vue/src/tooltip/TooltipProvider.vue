<script setup lang="ts">
import { provideGroup } from './group';
import type { TooltipProviderProps } from './types';

const props = withDefaults(defineProps<TooltipProviderProps>(), {
  delay: undefined,
  closeDelay: undefined,
  timeout: 400,
});
defineSlots<{ default?(): unknown }>();

provideGroup(props);
</script>

<template>
  <slot />
</template>
