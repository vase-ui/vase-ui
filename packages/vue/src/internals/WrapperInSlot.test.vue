<script setup lang="ts">
import { Tooltip } from '@vase-ui/vue/tooltip';

defineProps<{ closeOnClick?: boolean }>();
</script>

<template>
  <Tooltip.Root>
    <Tooltip.Trigger :close-on-click="closeOnClick"><slot /></Tooltip.Trigger>
  </Tooltip.Root>
</template>
