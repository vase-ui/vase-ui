<script setup lang="ts">
import { Field } from '../index';

type Part = 'label' | 'control' | 'description' | 'error';

defineProps<{
  parts: Part[];
  labelId?: string | undefined;
}>();
</script>

<template>
  <Field.Root>
    <template v-for="part in parts" :key="part">
      <Field.Label v-if="part === 'label'" :id="labelId" data-testid="label">Label</Field.Label>
      <Field.Control v-else-if="part === 'control'" data-testid="control" />
      <Field.Description v-else-if="part === 'description'" data-testid="description">
        Description
      </Field.Description>
      <Field.Error v-else-if="part === 'error'" match data-testid="error">Error</Field.Error>
    </template>
  </Field.Root>
</template>
