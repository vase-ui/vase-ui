<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';
</script>

<template>
  <main>
    <Field.Root>
      <label>
        Name
        <Input name="name" default-value="foo" data-testid="input" />
      </label>
    </Field.Root>
    <Field.Root invalid>
      <Input data-testid="invalid-input" />
    </Field.Root>
  </main>
</template>
