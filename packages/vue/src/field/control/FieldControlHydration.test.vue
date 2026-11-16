<script setup lang="ts">
import { onMounted, shallowRef } from 'vue';
import { Field } from '../index';

// `both` is one part before the control and one part after it.
withDefaults(
  defineProps<{
    value?: string | undefined;
    defaultValue?: string | undefined;
    disabled?: boolean | undefined;
    invalid?: boolean | undefined;
    as?: string | undefined;
    autofocus?: boolean | undefined;
    label?: 'before' | 'after' | 'both' | undefined;
    description?: 'after' | 'both' | undefined;
    laterRemovedAtMount?: boolean | undefined;
  }>(),
  { label: 'before' },
);

const isMounted = shallowRef(false);
onMounted(() => {
  isMounted.value = true;
});
</script>

<template>
  <Field.Root name="name" :disabled="disabled" :invalid="invalid" data-testid="root">
    <Field.Label
      v-if="label !== 'after'"
      :id="label === 'both' ? 'label-0' : undefined"
      data-testid="label"
    >
      Name
    </Field.Label>
    <Field.Description v-if="description === 'both'" id="desc-0">Your name</Field.Description>
    <Field.Control
      :as="as"
      :value="value"
      :default-value="defaultValue"
      :autofocus="autofocus"
      data-testid="control"
    />
    <template v-if="!(laterRemovedAtMount && isMounted)">
      <Field.Label v-if="label !== 'before'" id="label-a">Name</Field.Label>
      <Field.Description v-if="description !== undefined" id="desc-a">Your name</Field.Description>
    </template>
  </Field.Root>
</template>
