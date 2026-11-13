<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
import * as OTPField from '../index.parts';

// The root that comes first in the template mounts before the other root unmounts.
defineProps<{ swapped: boolean }>();
</script>

<template>
  <Field.Root validation-mode="onChange">
    <OTPField.Root v-if="swapped" key="new" :length="4" validation-type="none" required />
    <OTPField.Root v-if="!swapped" key="old" :length="4" validation-type="none" required />
  </Field.Root>
</template>
