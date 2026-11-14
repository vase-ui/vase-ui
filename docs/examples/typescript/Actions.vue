<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { Tooltip } from '@vase-ui/vue/tooltip';

const tooltip = useTemplateRef('tooltip');

function close() {
  const actions: Tooltip.Root.Actions | null = tooltip.value;
  actions?.close();
}
</script>

<template>
  <button type="button" @click="close">Close the tooltip</button>
  <Tooltip.Root ref="tooltip">
    <Tooltip.Trigger>Trigger</Tooltip.Trigger>
  </Tooltip.Root>
</template>
