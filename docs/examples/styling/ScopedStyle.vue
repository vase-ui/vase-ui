<script setup lang="ts">
import { DateField } from '@vase-ui/vue/date-field';
</script>

<template>
  <DateField.Root class="root" aria-label="Date">
    <DateField.Input class="input">
      <template #segment="{ segment }">
        <DateField.Segment v-if="segment.editable" :segment="segment" />
        <DateField.Literal v-else :segment="segment" />
      </template>
    </DateField.Input>
  </DateField.Root>
</template>

<style scoped>
.input {
  background-color: green;
}

.root {
  border: 1px solid green;
}
</style>
