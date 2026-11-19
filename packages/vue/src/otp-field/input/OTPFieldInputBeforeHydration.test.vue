<script setup lang="ts">
import { shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { OTPField } from '@vase-ui/vue/otp-field';
import type {
  OTPFieldRootChangeEventDetails,
  OTPFieldRootCompleteEventDetails,
} from '@vase-ui/vue/otp-field';

defineProps<{
  validationMode?: 'submit' | 'blur' | 'change' | undefined;
}>();

const model = shallowRef('');
const changes = shallowRef<string[]>([]);
const completes = shallowRef<string[]>([]);
const submits = shallowRef(0);

// Firefox loads the page again for a submit that no listener prevents.
function handleSubmit(event: SubmitEvent) {
  event.preventDefault();
  submits.value += 1;
}

function handleValueChange(value: string, details: OTPFieldRootChangeEventDetails) {
  changes.value = [...changes.value, `${value} (${details.reason})`];
}

function handleValueComplete(value: string, details: OTPFieldRootCompleteEventDetails) {
  completes.value = [...completes.value, `${value} (${details.reason})`];
}
</script>

<template>
  <form @submit="handleSubmit">
    <Field.Root :validation-mode="validationMode" data-testid="field">
      <Field.Label>Code</Field.Label>
      <OTPField.Root
        v-model="model"
        :length="4"
        auto-submit
        data-testid="root"
        @value-change="handleValueChange"
        @value-complete="handleValueComplete"
      >
        <OTPField.Input v-for="index in 4" :key="index" :data-testid="`slot-${index - 1}`" />
      </OTPField.Root>
      <Field.Error data-testid="error" />
    </Field.Root>
  </form>
  <button type="button" data-testid="outside">Outside</button>
  <output data-testid="model">{{ model }}</output>
  <output data-testid="changes">{{ changes.join('; ') }}</output>
  <output data-testid="completes">{{ completes.join('; ') }}</output>
  <output data-testid="submits">{{ submits }}</output>
</template>
