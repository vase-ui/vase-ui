<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
</script>

<template>
  <Field.Root name="website">
    <Field.Control type="url" required pattern="https?://.*" />
    <Field.Error />
  </Field.Root>
</template>
