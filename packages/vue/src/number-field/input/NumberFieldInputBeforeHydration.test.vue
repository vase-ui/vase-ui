<script setup lang="ts">
import { shallowRef } from 'vue';
import { NumberField } from '@vase-ui/vue/number-field';
import type {
  NumberFieldRootChangeEventDetails,
  NumberFieldRootCommitEventDetails,
} from '@vase-ui/vue/number-field';

const props = defineProps<{
  // The root is controlled with `v-model`.
  controlled?: boolean | undefined;
  value?: number | undefined;
  locale?: string | undefined;
  format?: Intl.NumberFormatOptions | undefined;
}>();

const model = shallowRef<number | null | undefined>(props.value);
const changes = shallowRef<string[]>([]);
const commits = shallowRef<string[]>([]);

function handleValueChange(value: number | null, details: NumberFieldRootChangeEventDetails) {
  changes.value = [...changes.value, `${value} (${details.reason})`];
}

function handleValueCommitted(value: number | null, details: NumberFieldRootCommitEventDetails) {
  commits.value = [...commits.value, `${value} (${details.reason})`];
}
</script>

<template>
  <NumberField.Root
    v-if="controlled"
    v-model="model"
    :locale="locale"
    :format="format"
    data-testid="root"
    @value-change="handleValueChange"
    @value-committed="handleValueCommitted"
  >
    <NumberField.Input data-testid="input" />
  </NumberField.Root>
  <NumberField.Root
    v-else
    :default-value="value"
    :locale="locale"
    :format="format"
    data-testid="root"
    @value-change="handleValueChange"
    @value-committed="handleValueCommitted"
  >
    <NumberField.Input data-testid="input" />
  </NumberField.Root>
  <button type="button" data-testid="outside">Outside</button>
  <output data-testid="model">{{ model }}</output>
  <output data-testid="changes">{{ changes.join('; ') }}</output>
  <output data-testid="commits">{{ commits.join('; ') }}</output>
</template>
