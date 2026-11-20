<script setup lang="ts">
import { Combobox } from '@vase-ui/vue/combobox';
</script>

<template>
  <Combobox.Root>
    <Combobox.Input aria-label="Fruit" @keydown="(event) => event.preventVaseUIHandler()" />
  </Combobox.Root>
</template>
