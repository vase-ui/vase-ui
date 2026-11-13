<script setup lang="ts">
import FieldControlPart from '../../../test/fixtures/FieldControlPart.vue';
import FieldErrorPart from '../../../test/fixtures/FieldErrorPart.vue';
import FieldScope from '../../../test/fixtures/FieldScope.vue';
import FormScope from '../../../test/fixtures/FormScope.vue';
import type { Errors } from '../form-context/FormContext';

defineProps<{
  errors?: Errors | undefined;
}>();
</script>

<template>
  <FormScope :errors="errors" data-testid="form">
    <FieldScope data-testid="root">
      <FieldControlPart id="first" name="a" value="x" />
      <FieldControlPart id="second" name="b" value="y" />
      <FieldErrorPart data-testid="error" />
    </FieldScope>
  </FormScope>
</template>
