<script setup lang="ts">
import { shallowRef, type PropType } from 'vue';
import { Field } from '../../src/field';
import { Form, type FormErrors } from '../../src/form';
import { OTPField } from '../../src/otp-field';

// A `Form` with a field that holds a root of six slots. The form writes each change of its
// errors, as `v-model:errors` does.
const props = defineProps({
  form: Object as PropType<Record<string, unknown>>,
  field: Object as PropType<Record<string, unknown>>,
  root: Object as PropType<Record<string, unknown>>,
  errors: Object as PropType<FormErrors>,
});
const errors = shallowRef(props.errors);
</script>

<template>
  <Form v-model:errors="errors" v-bind="form">
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
