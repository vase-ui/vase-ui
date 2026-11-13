<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { NumberField } from '@vase-ui/vue/number-field';

// The root that comes first in the template mounts before the other root unmounts.
defineProps<{ swapped: boolean }>();

const field = useTemplateRef('field');
defineExpose({ validate: () => field.value?.validate() });
</script>

<template>
  <Field.Root ref="field">
    <NumberField.Root v-if="swapped" key="new" required />
    <NumberField.Root v-if="!swapped" key="old" required />
    <Field.Error match="valueMissing" data-testid="error">Enter a number</Field.Error>
  </Field.Root>
</template>
