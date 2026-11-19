<script setup lang="ts">
import { Resizable } from '../../src/resizable';
</script>

<template>
  <Resizable.Handle data-key="h2" aria-label="Resize b" />
  <Resizable.Panel id="c" />
</template>
