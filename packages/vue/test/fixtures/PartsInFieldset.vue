<script setup lang="ts">
import type { PropType } from 'vue';
import { Fieldset } from '../../src/fieldset';
import { Form } from '../../src/form';
import FieldsetContent from './FieldsetContent.vue';

// With `native`, a native `<fieldset>` takes the place of the root.
defineProps({
  scene: { type: Object as PropType<{ disabled: boolean }>, required: true },
  native: Boolean,
  form: Object as PropType<Record<string, unknown>>,
  field: Object as PropType<Record<string, unknown>>,
  input: Object as PropType<Record<string, unknown>>,
});
</script>

<template>
  <Form v-bind="form">
    <fieldset v-if="native" :disabled="scene.disabled">
      <FieldsetContent native :field="field" :input="input" />
    </fieldset>
    <Fieldset.Root v-else :disabled="scene.disabled">
      <FieldsetContent :field="field" :input="input" />
    </Fieldset.Root>
    <button type="submit">Submit</button>
  </Form>
</template>
