<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
</script>

<template>
  <main>
    <Field.Root name="name" data-testid="root">
      <Field.Control default-value="foo" data-testid="control" />
    </Field.Root>
    <Field.Root invalid data-testid="invalid-root">
      <Field.Control data-testid="invalid-control" />
    </Field.Root>
  </main>
</template>
