<script setup lang="ts">
import { Tooltip } from '@vase-ui/vue/tooltip';
import type { TooltipRootProps } from '@vase-ui/vue/tooltip';

const props = withDefaults(defineProps<TooltipRootProps>(), { open: undefined });
</script>

<template>
  <Tooltip.Root v-bind="props"><slot /></Tooltip.Root>
</template>
