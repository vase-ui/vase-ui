<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';
</script>

<template>
  <Field.Root name="website">
    <Input type="url" required pattern="https?://.*" />
    <Field.Error />
  </Field.Root>
</template>
