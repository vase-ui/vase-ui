<script setup lang="ts">
import { onMounted, shallowRef } from 'vue';
import { Combobox } from '@vase-ui/vue/combobox';
import { Field } from '@vase-ui/vue/field';

defineProps<{
  label: 'before' | 'after';
  fieldLabel?: boolean | undefined;
  laterRemovedAtMount?: boolean | undefined;
}>();

const isMounted = shallowRef(false);
onMounted(() => {
  isMounted.value = true;
});
</script>

<template>
  <Field.Root>
    <Combobox.Root id="fruit">
      <Combobox.Label v-if="label === 'before'">Fruit</Combobox.Label>
      <Combobox.Trigger data-testid="trigger">Pick</Combobox.Trigger>
      <Combobox.Label v-if="label === 'after' && !(laterRemovedAtMount && isMounted)">
        Fruit
      </Combobox.Label>
    </Combobox.Root>
    <Field.Label v-if="fieldLabel && !(laterRemovedAtMount && isMounted)" id="label-a">
      Fruit
    </Field.Label>
  </Field.Root>
</template>
