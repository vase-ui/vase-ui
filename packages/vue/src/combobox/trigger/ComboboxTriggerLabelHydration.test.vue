<script setup lang="ts">
import { onMounted, shallowRef } from 'vue';
import { Combobox } from '@vase-ui/vue/combobox';
import { Field } from '@vase-ui/vue/field';

defineProps<{
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
      <Combobox.Trigger data-testid="trigger">Pick</Combobox.Trigger>
    </Combobox.Root>
    <template v-if="!(laterRemovedAtMount && isMounted)">
      <Field.Label id="label-a">Fruit</Field.Label>
      <Field.Description id="desc-a">Pick a fruit.</Field.Description>
    </template>
  </Field.Root>
  <Combobox.Root v-else id="fruit">
    <Combobox.Trigger data-testid="trigger">Pick</Combobox.Trigger>
    <Combobox.Label v-if="!(laterRemovedAtMount && isMounted)">Fruit</Combobox.Label>
  </Combobox.Root>
</template>
