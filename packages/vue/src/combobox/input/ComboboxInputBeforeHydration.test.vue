<script setup lang="ts">
import { shallowRef } from 'vue';
import { Combobox } from '@vase-ui/vue/combobox';
import type { ComboboxRootChangeEventDetails } from '@vase-ui/vue/combobox';
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';
import ComboboxListPart from '../../../test/fixtures/ComboboxListPart.vue';

defineProps<{
  // The input renders `Input` in `as`.
  rendersInput?: boolean | undefined;
}>();

const items = ['Malmö', 'Malta', 'Oslo'];
const inputValue = shallowRef('');
const changes = shallowRef<string[]>([]);

function handleInputValueChange(value: string, details: ComboboxRootChangeEventDetails) {
  changes.value = [...changes.value, `${value} (${details.reason})`];
}
</script>

<template>
  <Field.Root data-testid="field">
    <Combobox.Root
      v-model:input-value="inputValue"
      :items="items"
      @input-value-change="handleInputValueChange"
    >
      <Combobox.Input v-if="rendersInput" :as="Input" data-testid="input" />
      <Combobox.Input v-else data-testid="input" />
      <ComboboxListPart />
    </Combobox.Root>
  </Field.Root>
  <button type="button" data-testid="outside">Outside</button>
  <output data-testid="input-value">{{ inputValue }}</output>
  <output data-testid="changes">{{ changes.join('; ') }}</output>
</template>
