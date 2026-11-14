<script setup lang="ts">
import { Tooltip } from '@vase-ui/vue/tooltip';
import MyButton from './MyButton.vue';
</script>

<template>
  <Tooltip.Root>
    <Tooltip.Trigger>
      <template #render="{ props }">
        <MyButton v-bind="props" size="md">Open tooltip</MyButton>
      </template>
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Positioner>
        <Tooltip.Popup>Tooltip</Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>
</template>
