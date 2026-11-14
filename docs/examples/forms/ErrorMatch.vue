<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
</script>

<template>
  <Field.Root name="username">
    <Field.Control required />
    <Field.Error match="valueMissing">You must create a username</Field.Error>
  </Field.Root>
</template>
