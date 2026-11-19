<script setup lang="ts">
import { Field } from '../../src/field';
import { Input } from '../../src/input';

defineProps({ root: Object });
</script>

<template>
  <Field.Root v-bind="root">
    <Input />
    <Transition>
      <Field.Error />
    </Transition>
  </Field.Root>
</template>
