<script setup lang="ts">
import { Tooltip } from '@vuetify/v0';
import '../../../behavior/style.css';
</script>

<template>
  <div class="bench-page">
    <Tooltip.Root :open-delay="0" :close-delay="0">
      <Tooltip.Activator data-bench="trigger">Open</Tooltip.Activator>
      <Tooltip.Content data-bench="popup">Tooltip</Tooltip.Content>
    </Tooltip.Root>
  </div>
</template>
