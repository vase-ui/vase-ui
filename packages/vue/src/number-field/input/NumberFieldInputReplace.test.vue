<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import { NumberField } from '@vase-ui/vue/number-field';

// The input that comes first in the template mounts before the other input unmounts.
defineProps<{ swapped: boolean }>();
</script>

<template>
  <Form>
    <Field.Root name="quantity">
      <NumberField.Root required>
        <NumberField.Input v-if="swapped" key="new" data-testid="new" />
        <NumberField.Input v-if="!swapped" key="old" data-testid="old" />
      </NumberField.Root>
    </Field.Root>
    <button type="submit">Submit</button>
  </Form>
</template>
