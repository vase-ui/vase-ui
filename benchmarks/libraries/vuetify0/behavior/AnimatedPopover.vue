<script setup lang="ts">
import { Popover } from '@vuetify/v0';
import '../../../behavior/style.css';
</script>

<template>
  <div class="bench-page">
    <Popover.Root>
      <Popover.Activator data-bench="trigger">Open</Popover.Activator>
      <Popover.Content data-bench="popup">
        <h2>Title</h2>
        <p>Description</p>
      </Popover.Content>
    </Popover.Root>
  </div>
</template>
