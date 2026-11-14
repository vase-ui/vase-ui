<script setup lang="ts">
import * as Drawer from '../index.parts';
</script>

<template>
  <Drawer.Root default-open>
    <Drawer.Backdrop data-testid="backdrop" />
    <Drawer.Root default-open>
      <Drawer.Backdrop data-testid="nested-backdrop" force-render />
    </Drawer.Root>
  </Drawer.Root>
</template>
