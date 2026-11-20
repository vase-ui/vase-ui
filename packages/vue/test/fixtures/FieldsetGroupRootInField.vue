<script setup lang="ts">
import { Field } from '../../src/field';
import { Fieldset } from '../../src/fieldset';
import { Radio } from '../../src/radio';
import { RadioGroup } from '../../src/radio-group';
</script>

<template>
  <Field.Root>
    <Field.Label>Storage</Field.Label>
    <Fieldset.Root>
      <template #element="{ props, elementRef }">
        <RadioGroup v-bind="props" :ref="elementRef" class="Group">
          <label>SSD <Radio value="ssd" /></label>
        </RadioGroup>
      </template>
    </Fieldset.Root>
  </Field.Root>
</template>
