<script setup lang="ts">
import type { PropType } from 'vue';
import { Field } from '../../src/field';
import { Switch } from '../../src/switch';

// With `labelAfter`, the label and the description come after the switch.
defineProps({
  field: Object as PropType<Record<string, unknown>>,
  attrs: Object as PropType<Record<string, unknown>>,
  labelAfter: Boolean,
});
</script>

<template>
  <form>
    <Field.Root v-bind="field">
      <template v-if="labelAfter">
        <Switch v-bind="attrs" />
        <Field.Label>Wifi</Field.Label>
        <Field.Description id="description">Uses the network.</Field.Description>
      </template>
      <template v-else>
        <Field.Label>Wifi</Field.Label>
        <Switch v-bind="attrs" />
        <Field.Description id="description">Uses the network.</Field.Description>
      </template>
      <Field.Error id="error" />
    </Field.Root>
    <button type="reset">Reset</button>
  </form>
</template>
