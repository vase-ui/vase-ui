<script setup lang="ts">
import FieldControlPart from '../../../test/fixtures/FieldControlPart.vue';
import FieldErrorPart from '../../../test/fixtures/FieldErrorPart.vue';
import FieldScope from '../../../test/fixtures/FieldScope.vue';
import FieldStatePart from '../../../test/fixtures/FieldStatePart.vue';
import FormScope from '../../../test/fixtures/FormScope.vue';
import type { Errors } from '../form-context/FormContext';

defineProps<{
  rootName?: string | undefined;
  controlName?: string | undefined;
  errors?: Errors | undefined;
}>();
</script>

<template>
  <FormScope :errors="errors" data-testid="form">
    <FieldScope :name="rootName" data-testid="root">
      <FieldStatePart data-testid="before" />
      <FieldControlPart id="control" :name="controlName" value="x" data-testid="control" />
      <FieldStatePart data-testid="after" />
      <FieldErrorPart data-testid="error" />
    </FieldScope>
  </FormScope>
</template>
