<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
import { NumberField } from '@vase-ui/vue/number-field';

type Part = 'label' | 'input' | 'description';

defineProps<{
  parts: Part[];
  defaultValue?: number | undefined;
  format?: Intl.NumberFormatOptions | undefined;
  autocorrect?: string | undefined;
}>();
</script>

<template>
  <Field.Root>
    <template v-for="part in parts" :key="part">
      <Field.Label v-if="part === 'label'" data-testid="label">Label</Field.Label>
      <NumberField.Root v-else-if="part === 'input'" :default-value="defaultValue" :format="format">
        <NumberField.Input data-testid="input" :autocorrect="autocorrect" />
      </NumberField.Root>
      <Field.Description v-else-if="part === 'description'" data-testid="description">
        Description
      </Field.Description>
    </template>
  </Field.Root>
</template>
