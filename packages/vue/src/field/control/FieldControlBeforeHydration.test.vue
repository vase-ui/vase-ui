<script setup lang="ts">
import { shallowRef } from 'vue';
import { Field } from '../index';
import type { FieldControlChangeEventDetails } from '../index';

const props = defineProps<{
  // A value makes the control controlled, with `v-model:value`.
  value?: string | undefined;
  defaultValue?: string | undefined;
  as?: string | undefined;
  type?: string | undefined;
  validationMode?: 'onSubmit' | 'onBlur' | 'onChange' | undefined;
  cancels?: boolean | undefined;
}>();

const model = shallowRef(props.value);
const changes = shallowRef<string[]>([]);

function handleValueChange(value: string, details: FieldControlChangeEventDetails) {
  changes.value = [...changes.value, `${value} (${details.reason})`];
  if (props.cancels) {
    details.cancel();
  }
}
</script>

<template>
  <Field.Root name="name" :validation-mode="validationMode" data-testid="root">
    <Field.Label>Name</Field.Label>
    <Field.Control
      v-if="value !== undefined"
      v-model:value="model"
      :as="as"
      :type="type"
      data-testid="control"
      @value-change="handleValueChange"
    />
    <Field.Control
      v-else
      :default-value="defaultValue"
      :as="as"
      :type="type"
      data-testid="control"
      @value-change="handleValueChange"
    />
    <Field.Error data-testid="error" />
  </Field.Root>
  <button type="button" data-testid="outside">Outside</button>
  <output data-testid="model">{{ model }}</output>
  <output data-testid="changes">{{ changes.join('; ') }}</output>
</template>
