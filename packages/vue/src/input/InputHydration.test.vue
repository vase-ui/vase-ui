<script setup lang="ts">
import { Field } from '../field';
import { Input } from './index';

defineProps<{
  value?: string | undefined;
  defaultValue?: string | undefined;
  disabled?: boolean | undefined;
  invalid?: boolean | undefined;
  as?: string | undefined;
}>();
</script>

<template>
  <Field.Root name="name" :invalid="invalid">
    <label>
      Name
      <Input
        :as="as"
        :value="value"
        :default-value="defaultValue"
        :disabled="disabled"
        data-testid="input"
      />
    </label>
  </Field.Root>
</template>
