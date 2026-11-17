<script setup lang="ts">
import { Tooltip } from '@vase-ui/vue/tooltip';
import type { TooltipRootProps } from '@vase-ui/vue/tooltip';
import { useForwardProps } from '@vase-ui/vue/use-forward-props';

const props = defineProps<TooltipRootProps>();
const forwarded = useForwardProps(props);
</script>

<template>
  <Tooltip.Root v-bind="forwarded"><slot /></Tooltip.Root>
</template>
