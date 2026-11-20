<script setup lang="ts">
import { DateField } from '@vase-ui/vue/date-field';
import { DatePicker } from '@vase-ui/vue/date-picker';
</script>

<template>
  <DatePicker.Root>
    <DatePicker.Field aria-label="Departure date">
      <DateField.Input />
    </DatePicker.Field>
    <DatePicker.Trigger v-slot="{ text }">
      <span data-allow-mismatch="text">{{ text ?? 'Choose date' }}</span>
    </DatePicker.Trigger>
  </DatePicker.Root>
</template>
