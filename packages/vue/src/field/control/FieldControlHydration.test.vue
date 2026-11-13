<script setup lang="ts">
import { Field } from '../index';

defineProps<{
  value?: string | undefined;
  defaultValue?: string | undefined;
  disabled?: boolean | undefined;
  invalid?: boolean | undefined;
  as?: string | undefined;
  autofocus?: boolean | undefined;
}>();
</script>

<template>
  <Field.Root name="name" :disabled="disabled" :invalid="invalid" data-testid="root">
    <Field.Control
      :as="as"
      :value="value"
      :default-value="defaultValue"
      :autofocus="autofocus"
      data-testid="control"
    />
  </Field.Root>
</template>
