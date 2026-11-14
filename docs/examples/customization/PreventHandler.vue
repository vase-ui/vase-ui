<script setup lang="ts">
import { NumberField } from '@vase-ui/vue/number-field';
</script>

<template>
  <NumberField.Root>
    <NumberField.Input @paste="(event) => event.preventVaseUIHandler()" />
  </NumberField.Root>
</template>
