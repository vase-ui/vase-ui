<script setup lang="ts">
import { Checkbox } from '@vase-ui/vue/checkbox';
</script>

<template>
  <Checkbox.Root native-button>
    <template #render="{ props }">
      <label>
        <button v-bind="props" />
        Enable notifications
      </label>
    </template>
  </Checkbox.Root>
</template>
