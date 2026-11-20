<script setup lang="ts">
import { shallowRef, useTemplateRef } from 'vue';
import { Button } from '@vase-ui/vue/button';
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';
import { Form, type FormErrors } from '@vase-ui/vue/form';
import styles from './index.module.css';

interface FormState {
  serverErrors?: FormErrors;
}

const form = useTemplateRef('form');
const state = shallowRef<FormState>({});
const loading = shallowRef(false);

// An edit of a field removes its error.
function updateErrors(serverErrors: FormErrors) {
  state.value = { ...state.value, serverErrors };
}

async function formAction() {
  const formData = new FormData(form.value?.element ?? undefined);

  loading.value = true;
  state.value = await submitForm(state.value, formData);
  loading.value = false;
}

// On a real site, this function is a request to your server.
async function submitForm(_previousState: FormState, formData: FormData) {
  // Mimic a server response
  await new Promise((resolve) => {
    setTimeout(resolve, 1000);
  });

  try {
    const username = formData.get('username') as string | null;

    if (username === 'admin') {
      return { success: false, serverErrors: { username: "'admin' is reserved for system use" } };
    }

    // 50% chance the username is taken
    const success = Math.random() > 0.5;

    if (!success) {
      return {
        serverErrors: { username: `${username} is unavailable` },
      };
    }
  } catch {
    return { serverErrors: { username: 'A server error has occurred' } };
  }

  return {};
}
</script>

<template>
  <Form
    ref="form"
    :errors="state.serverErrors"
    :class="styles.Form"
    @update:errors="updateErrors"
    @submit="formAction"
  >
    <Field.Root name="username" :class="styles.Field">
      <Field.Label :class="styles.Label">Username</Field.Label>
      <Input
        type="text"
        autocomplete="username"
        required
        default-value="admin"
        placeholder="e.g. alice132"
        :class="styles.Input"
      />
      <Field.Error :class="styles.Error" />
    </Field.Root>
    <Button type="submit" :disabled="loading" focusable-when-disabled :class="styles.Button">
      Submit
    </Button>
  </Form>
</template>
