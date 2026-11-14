<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';

declare function isUsernameAvailable(username: string): Promise<boolean>;

async function validate(value: unknown) {
  if (value === 'admin') {
    // Return an error message when the value is not valid.
    return 'Reserved for system use.';
  }

  if (!(await isUsernameAvailable(String(value)))) {
    return `${String(value)} is unavailable.`;
  }

  // Return `null` when the value is valid.
  return null;
}
</script>

<template>
  <Field.Root
    name="username"
    validation-mode="onChange"
    :validation-debounce-time="300"
    :validate="validate"
  >
    <Field.Control required :minlength="3" />
    <Field.Error />
  </Field.Root>
</template>
