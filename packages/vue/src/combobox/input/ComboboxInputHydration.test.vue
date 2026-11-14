<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
import * as Combobox from '../index.parts';

type Part = 'label' | 'input' | 'description';

defineProps<{ parts: Part[] }>();
</script>

<template>
  <Field.Root>
    <template v-for="part in parts" :key="part">
      <Field.Label v-if="part === 'label'" data-testid="label">Label</Field.Label>
      <Combobox.Root v-else-if="part === 'input'" default-input-value="ma">
        <Combobox.Input data-testid="input" />
      </Combobox.Root>
      <Field.Description v-else-if="part === 'description'" data-testid="description">
        Description
      </Field.Description>
    </template>
  </Field.Root>
</template>
