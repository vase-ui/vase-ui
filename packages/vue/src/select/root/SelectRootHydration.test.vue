<script setup lang="ts">
import { onMounted, shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Select } from '@vase-ui/vue/select';

// In a field, the root has the generated id of the field until the mount. An `id` prop of the root
// thus does not give the label part the same id in the first client render and after the mount.
defineProps<{
  id?: string | undefined;
  name?: string | undefined;
  defaultValue?: string | null | undefined;
  items?: Record<string, string> | undefined;
  label?: 'before' | 'after' | undefined;
  placeholder?: string | undefined;
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
    <Select.Root>
      <Select.Label v-if="label === 'before'" data-testid="label">Font</Select.Label>
      <Select.Trigger>
        <Select.Value />
      </Select.Trigger>
    </Select.Root>
    <template v-if="!(laterRemovedAtMount && isMounted)">
      <Field.Label id="label-a">Font</Field.Label>
      <Field.Description id="desc-a">Pick a font.</Field.Description>
    </template>
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
