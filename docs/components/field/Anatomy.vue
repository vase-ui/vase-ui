<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';
</script>

<template>
  <Field.Root>
    <Field.Label />
    <Input />
    <Field.Description />
    <Field.Item />
    <Field.Error />
    <Field.Validity />
  </Field.Root>
</template>
