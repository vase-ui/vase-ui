<script setup lang="ts">
import { ref } from 'vue';
import { z } from 'zod';
import { Button } from '@vase-ui/vue/button';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import styles from './index.module.css';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  age: z.coerce.number('Age must be a number').positive('Age must be a positive number'),
});

async function submitForm(formValues: Form.Values) {
  const result = schema.safeParse(formValues);

  if (!result.success) {
    return {
      errors: z.flattenError(result.error).fieldErrors,
    };
  }

  return {
    errors: {},
  };
}

const errors = ref({});

async function onFormSubmit(formValues: Form.Values) {
  const response = await submitForm(formValues);
  errors.value = response.errors;
}
</script>

<template>
  <Form :class="styles.Form" :errors="errors" @form-submit="onFormSubmit">
    <Field.Root name="name" :class="styles.Field">
      <Field.Label :class="styles.Label">Name</Field.Label>
      <Field.Control placeholder="Enter name" :class="styles.Input" />
      <Field.Error :class="styles.Error" />
    </Field.Root>
    <Field.Root name="age" :class="styles.Field">
      <Field.Label :class="styles.Label">Age</Field.Label>
      <Field.Control placeholder="Enter age" :class="styles.Input" />
      <Field.Error :class="styles.Error" />
    </Field.Root>
    <Button type="submit" :class="styles.Button">Submit</Button>
  </Form>
</template>
