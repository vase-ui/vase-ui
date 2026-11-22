<script setup lang="ts">
import { Tooltip } from '@vuetify/v0';
</script>

<template>
  <Tooltip.Root>
    <Tooltip.Activator data-bench="trigger">Open</Tooltip.Activator>
    <Tooltip.Content data-bench="popup">Tooltip</Tooltip.Content>
  </Tooltip.Root>
</template>
