<script setup lang="ts">
import { DateField } from '@vase-ui/vue/date-field';
</script>

<template>
  <DateField.Root>
    <DateField.Input>
      <template #segment="{ segment }">
        <DateField.Segment v-if="segment.editable" :segment="segment" />
        <DateField.Literal v-else :segment="segment" />
      </template>
    </DateField.Input>
    <DateField.Clear aria-label="Clear the date">×</DateField.Clear>
  </DateField.Root>
</template>
