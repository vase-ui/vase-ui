<script setup lang="ts">
import { ref } from 'vue';
import { z } from 'zod';
import { Button } from '@vase-ui/vue/button';
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';
import { Form, type FormValues } from '@vase-ui/vue/form';
import styles from './index.module.css';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  age: z.coerce.number('Age must be a number').positive('Age must be a positive number'),
});

async function submitForm(formValues: FormValues) {
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

async function onSubmit(_event: SubmitEvent, formValues: FormValues) {
  const response = await submitForm(formValues);
  errors.value = response.errors;
}
</script>

<template>
  <Form :class="styles.Form" :errors="errors" @submit.prevent="onSubmit">
    <Field.Root name="name" :class="styles.Field">
      <Field.Label :class="styles.Label">Name</Field.Label>
      <Input placeholder="Enter name" :class="styles.Input" />
      <Field.Error :class="styles.Error" />
    </Field.Root>
    <Field.Root name="age" :class="styles.Field">
      <Field.Label :class="styles.Label">Age</Field.Label>
      <Input placeholder="Enter age" :class="styles.Input" />
      <Field.Error :class="styles.Error" />
    </Field.Root>
    <Button type="submit" :class="styles.Button">Submit</Button>
  </Form>
</template>
