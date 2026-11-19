<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';
</script>

<template>
  <Field.Root v-slot="{ validity, value }" name="email">
    <Field.Label>Email</Field.Label>
    <Input type="email" required />
    <p v-if="validity.typeMismatch">{{ value }} is not an email address.</p>
  </Field.Root>
</template>
