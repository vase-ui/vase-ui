<script setup lang="ts">
import { ref, shallowRef, useTemplateRef } from 'vue';
import { Button } from '@vase-ui/vue/button';
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';
import { Form } from '@vase-ui/vue/form';
import styles from './index.module.css';

const form = useTemplateRef('form');
const errors = ref({});
const loading = shallowRef(false);

async function onSubmit() {
  const formData = new FormData(form.value?.element ?? undefined);
  const value = String(formData.get('url'));

  loading.value = true;
  const response = await submitForm(value);
  const serverErrors = {
    url: response.error,
  };

  errors.value = serverErrors;
  loading.value = false;
}

async function submitForm(value: string) {
  // Mimic a server response
  await new Promise((resolve) => {
    setTimeout(resolve, 1000);
  });

  try {
    const url = new URL(value);

    if (url.hostname.endsWith('example.com')) {
      return { error: 'The example domain is not allowed' };
    }
  } catch {
    return { error: 'This is not a valid URL' };
  }

  return { success: true };
}
</script>

<template>
  <Form ref="form" :class="styles.Form" :errors="errors" @submit="onSubmit">
    <Field.Root name="url" :class="styles.Field">
      <Field.Label :class="styles.Label">Homepage</Field.Label>
      <Input
        type="url"
        required
        default-value="https://example.com"
        placeholder="https://example.com"
        pattern="https?://.*"
        :class="styles.Input"
      />
      <Field.Error :class="styles.Error" />
    </Field.Root>
    <Button type="submit" :disabled="loading" focusable-when-disabled :class="styles.Button">
      Submit
    </Button>
  </Form>
</template>
