<script setup lang="ts">
import { useForm } from '@tanstack/vue-form';
import { Field } from '@vase-ui/vue/field';

const form = useForm({ defaultValues: { username: '' } });

async function checkUsername({ value: username }: { value: string }) {
  const result = await fetch(`https://api.example.com/usernames/${username}`);
  return result.ok ? undefined : `${username} is not available.`;
}
</script>

<template>
  <form>
    <form.Field v-slot="{ field }" name="username" :validators="{ onChangeAsync: checkUsername }">
      <Field.Root :name="field.name" />
    </form.Field>
  </form>
</template>
