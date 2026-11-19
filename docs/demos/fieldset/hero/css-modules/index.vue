<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';
import { Fieldset } from '@vase-ui/vue/fieldset';
import styles from './index.module.css';
</script>

<template>
  <Fieldset.Root :class="styles.Fieldset">
    <Fieldset.Legend :class="styles.Legend">Billing details</Fieldset.Legend>

    <Field.Root :class="styles.Field">
      <Field.Label :class="styles.Label">Company</Field.Label>
      <Input placeholder="Enter company name" :class="styles.Input" />
    </Field.Root>

    <Field.Root :class="styles.Field">
      <Field.Label :class="styles.Label">Tax ID</Field.Label>
      <Input placeholder="Enter fiscal number" :class="styles.Input" />
    </Field.Root>
  </Fieldset.Root>
</template>
