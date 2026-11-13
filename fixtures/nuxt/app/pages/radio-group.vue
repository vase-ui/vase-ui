<script setup lang="ts">
import { ref } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';

// A radio has no content, so an inline style gives it a size that a click can reach.
const RADIO_STYLE = 'display: inline-block; width: 24px; height: 24px; border: 1px solid';

const fruit = ref('banana');
</script>

<template>
  <main>
    <form data-testid="form">
      <Field.Root>
        <RadioGroup v-model:value="fruit" name="fruit" data-testid="fruit">
          <Radio.Root value="apple" aria-label="Apple" :style="RADIO_STYLE" data-testid="apple">
            <Radio.Indicator data-testid="apple-indicator" />
          </Radio.Root>
          <Radio.Root value="banana" aria-label="Banana" :style="RADIO_STYLE" data-testid="banana">
            <Radio.Indicator data-testid="banana-indicator" />
          </Radio.Root>
          <Radio.Root value="cherry" aria-label="Cherry" :style="RADIO_STYLE" data-testid="cherry">
            <Radio.Indicator keep-mounted data-testid="cherry-indicator" />
          </Radio.Root>
        </RadioGroup>
        <Field.Label data-testid="label">Fruit</Field.Label>
      </Field.Root>
      <output data-testid="value">{{ fruit }}</output>
    </form>
    <RadioGroup data-testid="empty">
      <Radio.Root value="x" disabled aria-label="X" :style="RADIO_STYLE" data-testid="empty-x" />
      <Radio.Root value="y" aria-label="Y" :style="RADIO_STYLE" data-testid="empty-y" />
      <Radio.Root value="z" aria-label="Z" :style="RADIO_STYLE" data-testid="empty-z" />
    </RadioGroup>
  </main>
</template>
