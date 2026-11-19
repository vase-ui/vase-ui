<script setup lang="ts">
import type { PropType } from 'vue';
import { Field } from '../../src/field';
import { Input } from '../../src/input';

defineProps({ scene: { type: Object as PropType<{ disabled: boolean }>, required: true } });
</script>

<template>
  <Field.Root invalid>
    <Field.Label>Company</Field.Label>
    <fieldset :disabled="scene.disabled">
      <Input id="company" />
    </fieldset>
  </Field.Root>
</template>
