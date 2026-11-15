<script setup lang="ts">
import { onMounted, shallowRef } from 'vue';
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
import { Field } from '@vase-ui/vue/field';

withDefaults(
  defineProps<{
    defaultValue?: string[];
    disabled?: boolean;
    label?: 'none' | 'before' | 'after';
    labelId?: string | undefined;
    descriptionId?: string | undefined;
    laterRemovedAtMount?: boolean;
  }>(),
  { defaultValue: () => [], disabled: false, label: 'none' },
);

const isMounted = shallowRef(false);
onMounted(() => {
  isMounted.value = true;
});
</script>

<template>
  <Field.Root name="fruits" data-testid="field">
    <Field.Label v-if="label === 'before'" data-testid="label">Fruits</Field.Label>
    <CheckboxGroup data-testid="group" :default-value="defaultValue" :disabled="disabled">
      <Checkbox.Root data-testid="apple" value="apple" />
      <Checkbox.Root data-testid="banana" value="banana" />
    </CheckboxGroup>
    <template v-if="!(laterRemovedAtMount && isMounted)">
      <Field.Label v-if="label === 'after'" :id="labelId" data-testid="label">Fruits</Field.Label>
      <Field.Description :id="descriptionId" data-testid="description">Pick</Field.Description>
    </template>
  </Field.Root>
</template>
