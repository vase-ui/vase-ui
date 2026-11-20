<script setup lang="ts">
import { Field } from '../../src/field';

// With `field`, a `Field.Root` holds the slot, and its label comes after the slot.
defineProps<{ field?: boolean | undefined }>();
</script>

<template>
  <Field.Root v-if="field" name="trip">
    <slot />
    <Field.Label>Trip dates</Field.Label>
  </Field.Root>
  <slot v-else />
</template>
