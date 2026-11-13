<script setup lang="ts">
import { Field } from '../index';

// The control that comes first in the template mounts before the other control unmounts.
defineProps<{ swapped: boolean }>();
</script>

<template>
  <Field.Root validation-mode="onChange">
    <Field.Control v-if="swapped" key="new" required data-testid="new" />
    <Field.Control v-if="!swapped" key="old" required data-testid="old" />
  </Field.Root>
</template>
