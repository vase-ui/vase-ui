<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';
</script>

<template>
  <Field.Root name="username">
    <Input required />
    <Field.Error match="valueMissing">You must create a username</Field.Error>
  </Field.Root>
</template>
