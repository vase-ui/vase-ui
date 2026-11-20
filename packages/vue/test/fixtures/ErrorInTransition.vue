<script setup lang="ts">
import { Field } from '../../src/field';
import { Input } from '../../src/input';

defineProps({ root: Object, error: Object });
</script>

<template>
  <Field.Root v-bind="root">
    <Input />
    <Transition name="error">
      <Field.Error v-bind="error" />
    </Transition>
  </Field.Root>
</template>

<style>
.error-enter-active,
.error-leave-active {
  transition: opacity 200ms linear;
}
.error-enter-from,
.error-leave-to {
  opacity: 0;
}
</style>
