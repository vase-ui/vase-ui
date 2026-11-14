<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
import { Fieldset } from '@vase-ui/vue/fieldset';
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';
</script>

<template>
  <Field.Root>
    <Fieldset.Root>
      <template #render="{ props }">
        <RadioGroup v-bind="props">
          <Fieldset.Legend>Storage type</Fieldset.Legend>
          <Field.Item>
            <Field.Label>
              <Radio.Root value="ssd" />
              SSD
            </Field.Label>
          </Field.Item>
          <Field.Item>
            <Field.Label>
              <Radio.Root value="hdd" />
              HDD
            </Field.Label>
          </Field.Item>
        </RadioGroup>
      </template>
    </Fieldset.Root>
  </Field.Root>
</template>
