<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';

declare function isUsernameAvailable(username: string): Promise<boolean>;

async function validate(value: unknown) {
  if (value === 'admin') {
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
    validation-mode="change"
    :validation-debounce-time="300"
    :validate="validate"
  >
    <Input required :minlength="3" />
    <Field.Error />
  </Field.Root>
</template>
