<script setup lang="ts">
import type { PropType } from 'vue';
import { Field } from '../../src/field';

// With no `field`, the slot renders alone.
defineProps({ field: Object as PropType<Record<string, unknown>> });
</script>

<template>
  <Field.Root v-if="field" v-bind="field">
    <Field.Label>Name</Field.Label>
    <slot />
    <Field.Description id="description">Your full name.</Field.Description>
    <Field.Error id="error" />
  </Field.Root>
  <slot v-else />
</template>
