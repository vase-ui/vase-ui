<script setup lang="ts">
import { ref } from 'vue';
import { z } from 'zod';
import { Button } from '@vase-ui/vue/button';
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';
import { Form, type FormValues } from '@vase-ui/vue/form';

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
  <Form class="flex w-full max-w-64 flex-col gap-4" :errors="errors" @submit.prevent="onSubmit">
    <Field.Root name="name" class="flex flex-col items-start gap-1">
      <Field.Label class="text-sm font-bold text-neutral-950 dark:text-white">Name</Field.Label>
      <Input
        placeholder="Enter name"
        class="h-8 w-full border border-neutral-950 bg-white dark:bg-neutral-950 px-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 placeholder:text-neutral-500 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:text-white dark:placeholder:text-neutral-400"
      />
      <Field.Error class="text-sm text-red-700 dark:text-red-400" />
    </Field.Root>
    <Field.Root name="age" class="flex flex-col items-start gap-1">
      <Field.Label class="text-sm font-bold text-neutral-950 dark:text-white">Age</Field.Label>
      <Input
        placeholder="Enter age"
        class="h-8 w-full border border-neutral-950 bg-white dark:bg-neutral-950 px-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 placeholder:text-neutral-500 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:text-white dark:placeholder:text-neutral-400"
      />
      <Field.Error class="text-sm text-red-700 dark:text-red-400" />
    </Field.Root>
    <Button
      type="submit"
      class="flex h-8 items-center justify-center gap-2 rounded-none border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 active:not-data-disabled:bg-neutral-200 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white data-disabled:border-neutral-500 data-disabled:text-neutral-500 disabled:border-neutral-500 disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400"
      >Submit</Button
    >
  </Form>
</template>
