<script setup lang="ts">
import { Form } from '@vase-ui/vue/form';
import FieldControlPart from '../../test/fixtures/FieldControlPart.vue';
import FieldScope from '../../test/fixtures/FieldScope.vue';
import type { Errors } from '../internals/form-context';

defineProps<{
  errors?: Errors | undefined;
  firstValue?: string | undefined;
  secondValue?: string | undefined;
}>();
</script>

<template>
  <Form data-testid="form" :errors="errors">
    <input name="native" value="native" />
    <FieldScope name="first" data-testid="first-field">
      <FieldControlPart id="first-control" :value="firstValue" data-testid="first" />
    </FieldScope>
    <FieldScope name="second" data-testid="second-field">
      <FieldControlPart id="second-control" :value="secondValue" data-testid="second" />
    </FieldScope>
  </Form>
</template>
