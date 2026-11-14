<script setup lang="ts">
import { Select } from '@vase-ui/vue/select';

defineProps<{
  id?: string | undefined;
  name?: string | undefined;
  defaultValue?: string | null | undefined;
  items?: Record<string, string> | undefined;
  label?: 'before' | 'after' | undefined;
  placeholder?: string | undefined;
}>();
</script>

<template>
  <Select.Root :id="id" :name="name" :default-value="defaultValue" :items="items">
    <Select.Label v-if="label === 'before'">Font</Select.Label>
    <Select.Trigger>
      <Select.Value :placeholder="placeholder" />
      <Select.Icon />
    </Select.Trigger>
    <Select.Label v-if="label === 'after'">Font</Select.Label>
  </Select.Root>
</template>
