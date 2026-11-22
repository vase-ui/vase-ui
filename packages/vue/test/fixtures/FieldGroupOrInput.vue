<script setup lang="ts">
import type { PropType } from 'vue';
import { Checkbox } from '../../src/checkbox';
import { CheckboxGroup } from '../../src/checkbox-group';
import { Field } from '../../src/field';
import { Input } from '../../src/input';

// With `scene.group`, the control of the field is a checkbox group, and else an input.
defineProps({ scene: { type: Object as PropType<{ group: boolean }>, required: true } });
</script>

<template>
  <Field.Root>
    <Field.Label>Answer</Field.Label>
    <CheckboxGroup v-if="scene.group">
      <Checkbox value="yes" />
    </CheckboxGroup>
    <Input v-else />
  </Field.Root>
</template>
