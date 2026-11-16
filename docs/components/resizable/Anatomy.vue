<script setup lang="ts">
import { Resizable } from '@vase-ui/vue/resizable';
</script>

<template>
  <Resizable.Root>
    <Resizable.Panel />
    <Resizable.Handle />
    <Resizable.Panel />
  </Resizable.Root>
</template>
