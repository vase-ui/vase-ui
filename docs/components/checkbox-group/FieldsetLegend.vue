<script setup lang="ts">
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
import { Field } from '@vase-ui/vue/field';
import { Fieldset } from '@vase-ui/vue/fieldset';
</script>

<template>
  <Field.Root>
    <Fieldset.Root :as="CheckboxGroup">
      <Fieldset.Legend>Backup schedule</Fieldset.Legend>
      <Field.Item>
        <Checkbox.Root value="daily" />
        <Field.Label>Daily</Field.Label>
        <Field.Description>Daily at 00:00</Field.Description>
      </Field.Item>
      <Field.Item>
        <Checkbox.Root value="monthly" />
        <Field.Label>Monthly</Field.Label>
        <Field.Description>On the 5th of every month at 23:59</Field.Description>
      </Field.Item>
    </Fieldset.Root>
  </Field.Root>
</template>
