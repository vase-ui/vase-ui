<script setup lang="ts">
import { onMounted, shallowRef } from 'vue';
import { Combobox } from '@vase-ui/vue/combobox';
import { Field } from '@vase-ui/vue/field';

// In a field, the root has the generated id of the field until the mount. An `id` prop of the root
// thus does not give the label part the same id in the first client render and after the mount.
defineProps<{
  label?: 'before' | 'after' | undefined;
  field?: boolean | undefined;
  laterRemovedAtMount?: boolean | undefined;
}>();

const isMounted = shallowRef(false);
onMounted(() => {
  isMounted.value = true;
});
</script>

<template>
  <Field.Root v-if="field">
    <Combobox.Root>
      <Combobox.Label v-if="label === 'before'" data-testid="label">Fruit</Combobox.Label>
      <Combobox.Trigger data-testid="trigger">Pick</Combobox.Trigger>
    </Combobox.Root>
    <template v-if="!(laterRemovedAtMount && isMounted)">
      <Field.Label id="label-a">Fruit</Field.Label>
      <Field.Description id="desc-a">Pick a fruit.</Field.Description>
    </template>
  </Field.Root>
  <Combobox.Root v-else id="fruit">
    <Combobox.Label v-if="label === 'before'" data-testid="label">Fruit</Combobox.Label>
    <Combobox.Trigger data-testid="trigger">Pick</Combobox.Trigger>
    <Combobox.Label v-if="label === 'after' && !(laterRemovedAtMount && isMounted)">
      Fruit
    </Combobox.Label>
  </Combobox.Root>
</template>
