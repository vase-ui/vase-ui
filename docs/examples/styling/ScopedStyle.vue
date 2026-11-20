<script setup lang="ts">
import { DateField } from '@vase-ui/vue/date-field';
</script>

<template>
  <div class="field">
    <DateField.Root class="root" aria-label="Date">
      <DateField.Input class="input">
        <template #segment="{ segment }">
          <DateField.Segment v-if="segment.editable" :segment="segment" />
          <DateField.Literal v-else :segment="segment" />
        </template>
      </DateField.Input>
    </DateField.Root>
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
