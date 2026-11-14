<script setup lang="ts">
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
import { Field } from '@vase-ui/vue/field';
import { Fieldset } from '@vase-ui/vue/fieldset';
</script>

<template>
  <Field.Root>
    <Fieldset.Root>
      <template #render="{ props }">
        <CheckboxGroup v-bind="props">
          <Fieldset.Legend>Allowed network protocols</Fieldset.Legend>
          <Field.Item>
            <Field.Label>
              <Checkbox.Root value="http" />
              HTTP
            </Field.Label>
          </Field.Item>
          <Field.Item>
            <Field.Label>
              <Checkbox.Root value="https" />
              HTTPS
            </Field.Label>
          </Field.Item>
        </CheckboxGroup>
      </template>
    </Fieldset.Root>
  </Field.Root>
</template>
