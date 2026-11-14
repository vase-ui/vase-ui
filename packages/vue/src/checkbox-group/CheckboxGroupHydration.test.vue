<script setup lang="ts">
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
import { Field } from '@vase-ui/vue/field';

withDefaults(
  defineProps<{
    defaultValue?: string[];
    disabled?: boolean;
    label?: 'none' | 'before' | 'after';
  }>(),
  { defaultValue: () => [], disabled: false, label: 'none' },
);
</script>

<template>
  <Field.Root name="fruits" data-testid="field">
    <Field.Label v-if="label === 'before'" data-testid="label">Fruits</Field.Label>
    <CheckboxGroup data-testid="group" :default-value="defaultValue" :disabled="disabled">
      <Checkbox.Root data-testid="apple" value="apple" />
      <Checkbox.Root data-testid="banana" value="banana" />
    </CheckboxGroup>
    <Field.Label v-if="label === 'after'" data-testid="label">Fruits</Field.Label>
    <Field.Description data-testid="description">Pick</Field.Description>
  </Field.Root>
</template>
