<script setup lang="ts">
import { ref } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';

const fruit = ref('banana');
</script>

<template>
  <main>
    <form data-testid="form">
      <Field.Root>
        <RadioGroup v-model="fruit" name="fruit" data-testid="fruit">
          <Radio value="apple" aria-label="Apple" data-testid="apple" />
          <Radio value="banana" aria-label="Banana" data-testid="banana" />
          <Radio value="cherry" aria-label="Cherry" data-testid="cherry" />
        </RadioGroup>
        <Field.Label data-testid="label">Fruit</Field.Label>
      </Field.Root>
      <output data-testid="value">{{ fruit }}</output>
    </form>
    <RadioGroup data-testid="empty">
      <Radio value="x" disabled aria-label="X" data-testid="empty-x" />
      <Radio value="y" aria-label="Y" data-testid="empty-y" />
      <Radio value="z" aria-label="Z" data-testid="empty-z" />
    </RadioGroup>
  </main>
</template>
