<script setup lang="ts">
import * as Drawer from '../index.parts';
</script>

<template>
  <Drawer.Root>
    <Drawer.SwipeArea data-testid="closed-swipe-area" />
  </Drawer.Root>
  <Drawer.Root default-open swipe-direction="right">
    <Drawer.SwipeArea data-testid="open-swipe-area" />
  </Drawer.Root>
</template>
