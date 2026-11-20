<script setup lang="ts">
import { NumberField } from '@vase-ui/vue/number-field';
</script>

<template>
  <NumberField.Root>
    <NumberField.ScrubArea />
    <NumberField.Group>
      <NumberField.Decrement aria-label="Decrease" />
      <NumberField.Input />
      <NumberField.Increment aria-label="Increase" />
    </NumberField.Group>
  </NumberField.Root>
</template>
