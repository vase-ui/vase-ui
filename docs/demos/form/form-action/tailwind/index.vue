<script setup lang="ts">
import { shallowRef, useTemplateRef } from 'vue';
import { Button } from '@vase-ui/vue/button';
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';
import { Form } from '@vase-ui/vue/form';

interface FormState {
  serverErrors?: Form.Props['errors'];
}

const form = useTemplateRef('form');
const state = shallowRef<FormState>({});
const loading = shallowRef(false);

async function formAction(event: SubmitEvent) {
  event.preventDefault();
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
    class="flex w-full max-w-64 flex-col gap-4"
    @submit="formAction"
  >
    <Field.Root name="username" class="flex flex-col items-start gap-1">
      <Field.Label class="text-sm font-bold text-neutral-950 dark:text-white">Username</Field.Label>
      <Input
        type="text"
        autocomplete="username"
        required
        default-value="admin"
        placeholder="e.g. alice132"
        class="h-8 w-full border border-neutral-950 bg-white dark:bg-neutral-950 px-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 placeholder:text-neutral-500 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:text-white dark:placeholder:text-neutral-400"
      />
      <Field.Error class="text-sm text-red-700 dark:text-red-400" />
    </Field.Root>
    <Button
      type="submit"
      :disabled="loading"
      focusable-when-disabled
      class="flex h-8 items-center justify-center gap-2 rounded-none border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 active:not-data-disabled:bg-neutral-200 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white data-disabled:border-neutral-500 data-disabled:text-neutral-500 disabled:border-neutral-500 disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400"
    >
      Submit
    </Button>
  </Form>
</template>
