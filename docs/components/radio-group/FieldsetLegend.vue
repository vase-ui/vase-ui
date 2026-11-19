<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
import { Fieldset } from '@vase-ui/vue/fieldset';
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';
</script>

<template>
  <Field.Root name="storage">
    <Fieldset.Root>
      <Fieldset.Legend>Storage type</Fieldset.Legend>
      <RadioGroup>
        <Field.Item>
          <Radio value="ssd" />
          <Field.Label>SSD</Field.Label>
        </Field.Item>
        <Field.Item>
          <Radio value="hdd" />
          <Field.Label>HDD</Field.Label>
        </Field.Item>
      </RadioGroup>
    </Fieldset.Root>
  </Field.Root>
</template>
