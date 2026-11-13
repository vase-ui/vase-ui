<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';

defineProps<{ defaultValue: string | null }>();
</script>

<template>
  <Field.Root data-testid="field">
    <RadioGroup data-testid="group" :default-value="defaultValue">
      <Radio.Root data-testid="none" :value="null" />
      <Radio.Root data-testid="a" value="a" />
      <Radio.Root data-testid="b" value="b" />
      <Radio.Root data-testid="c" value="c" />
    </RadioGroup>
    <Field.Label data-testid="label">Fruit</Field.Label>
    <Field.Description data-testid="description">Pick one.</Field.Description>
  </Field.Root>
</template>
