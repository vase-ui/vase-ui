<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';
</script>

<template>
  <Field.Root v-slot="{ value }" name="email">
    <Field.Label>Email</Field.Label>
    <Input type="email" required />
    <Field.Error match="typeMismatch">{{ value }} is not an email address.</Field.Error>
  </Field.Root>
</template>
