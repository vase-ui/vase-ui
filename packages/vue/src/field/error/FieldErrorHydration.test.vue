<script setup lang="ts">
import { Form } from '../../form';
import { Field } from '../index';

defineProps<{
  errors: Record<string, string | string[]>;
}>();
</script>

<template>
  <Form :errors="errors">
    <Field.Root name="name">
      <Field.Control data-testid="control" />
      <Field.Error data-testid="error" />
      <Field.Error match data-testid="always">Always</Field.Error>
    </Field.Root>
  </Form>
</template>
