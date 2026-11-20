<script setup lang="ts">
import type { PropType } from 'vue';
import { Field } from '../../src/field';
import { Form } from '../../src/form';
import { OTPField } from '../../src/otp-field';

// A `Form` with a field that holds a root of six slots, and a field with an `Input` after it.
defineProps({
  form: Object as PropType<Record<string, unknown>>,
  field: Object as PropType<Record<string, unknown>>,
  root: Object as PropType<Record<string, unknown>>,
});
</script>

<template>
  <Form v-bind="form">
    <Field.Root v-bind="field">
      <Field.Label>Code</Field.Label>
      <OTPField.Root :length="6" v-bind="root">
        <OTPField.Input v-for="n in 6" :key="n" />
      </OTPField.Root>
      <Field.Error id="error" />
    </Field.Root>
    <button type="submit">Submit</button>
  </Form>
</template>
