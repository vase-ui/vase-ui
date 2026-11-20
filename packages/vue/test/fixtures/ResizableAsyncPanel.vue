<script setup lang="ts">
import { Resizable } from '../../src/resizable';

// The `setup` waits, so the panel registers after the panels beside it.
await Promise.resolve();
</script>

<template>
  <Resizable.Panel id="late" />
</template>
