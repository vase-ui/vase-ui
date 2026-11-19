<script setup lang="ts">
import { ref, shallowRef, useTemplateRef } from 'vue';
import { Button } from '@vase-ui/vue/button';
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';
import { Form } from '@vase-ui/vue/form';

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
  <Form ref="form" class="flex w-full max-w-64 flex-col gap-4" :errors="errors" @submit="onSubmit">
    <Field.Root name="url" class="flex flex-col items-start gap-1">
      <Field.Label class="text-sm font-bold text-neutral-950 dark:text-white">Homepage</Field.Label>
      <Input
        type="url"
        required
        default-value="https://example.com"
        placeholder="https://example.com"
        pattern="https?://.*"
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
