<script setup lang="ts">
import { NumberField } from '@vase-ui/vue/number-field';
</script>

<template>
  <NumberField.Root>
    <NumberField.ScrubArea>
      <NumberField.ScrubAreaCursor />
    </NumberField.ScrubArea>
    <NumberField.Group>
      <NumberField.Decrement />
      <NumberField.Input />
      <NumberField.Increment />
    </NumberField.Group>
  </NumberField.Root>
</template>
