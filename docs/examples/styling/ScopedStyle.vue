<script setup lang="ts">
import { NumberField } from '@vase-ui/vue/number-field';
</script>

<template>
  <div class="field">
    <NumberField.Root class="root">
      <NumberField.Input class="input" aria-label="Amount" />
    </NumberField.Root>
  </div>
</template>

<style scoped>
.input {
  background-color: green;
}

.field :deep(.root) {
  border: 1px solid green;
}
</style>
