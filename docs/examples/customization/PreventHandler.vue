<script setup lang="ts">
import { Select } from '@vase-ui/vue/select';
</script>

<template>
  <Select.Root>
    <Select.Trigger aria-label="Fruit" @keydown="(event) => event.preventVaseUIHandler()" />
  </Select.Root>
</template>
