<script setup lang="ts">
import { Field } from '../field';
import { Input } from './index';

defineProps<{ defaultValue?: string | undefined }>();
</script>

<template>
  <Field.Root name="name">
    <label>
      Name
      <Input :default-value="defaultValue" data-testid="input" />
    </label>
  </Field.Root>
</template>
