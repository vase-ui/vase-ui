<script setup lang="ts">
import { onMounted, shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Select } from '@vase-ui/vue/select';

defineProps<{
  id?: string | undefined;
  name?: string | undefined;
  defaultValue?: string | null | undefined;
  items?: Record<string, string> | undefined;
  label?: 'before' | 'after' | undefined;
  placeholder?: string | undefined;
  fieldLabel?: boolean | undefined;
  laterRemovedAtMount?: boolean | undefined;
}>();

const isMounted = shallowRef(false);
onMounted(() => {
  isMounted.value = true;
});
</script>

<template>
  <Field.Root v-if="fieldLabel">
    <Select.Root :id="id">
      <Select.Label v-if="label === 'before'">Font</Select.Label>
      <Select.Trigger>
        <Select.Value />
      </Select.Trigger>
    </Select.Root>
    <Field.Label v-if="!(laterRemovedAtMount && isMounted)" id="label-a">Font</Field.Label>
  </Field.Root>
  <Select.Root v-else :id="id" :name="name" :default-value="defaultValue" :items="items">
    <Select.Label v-if="label === 'before'">Font</Select.Label>
    <Select.Trigger>
      <Select.Value :placeholder="placeholder" />
      <Select.Icon />
    </Select.Trigger>
    <Select.Label v-if="label === 'after' && !(laterRemovedAtMount && isMounted)"
      >Font</Select.Label
    >
  </Select.Root>
</template>
