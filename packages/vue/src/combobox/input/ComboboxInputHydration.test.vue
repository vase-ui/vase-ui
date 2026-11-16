<script setup lang="ts">
import { onMounted, shallowRef } from 'vue';
import { Combobox } from '@vase-ui/vue/combobox';
import { Field } from '@vase-ui/vue/field';

type Part = 'label' | 'input' | 'description';

const props = defineProps<{
  parts: Part[];
  labelId?: string | undefined;
  descriptionId?: string | undefined;
  laterRemovedAtMount?: boolean | undefined;
}>();

const isMounted = shallowRef(false);
onMounted(() => {
  isMounted.value = true;
});

function isShown(part: Part) {
  return !(
    props.laterRemovedAtMount &&
    isMounted.value &&
    props.parts.indexOf(part) > props.parts.indexOf('input')
  );
}
</script>

<template>
  <Field.Root>
    <template v-for="part in parts" :key="part">
      <Field.Label v-if="part === 'label' && isShown(part)" :id="labelId" data-testid="label">
        Label
      </Field.Label>
      <Combobox.Root v-else-if="part === 'input'" default-input-value="ma">
        <Combobox.Input data-testid="input" />
      </Combobox.Root>
      <Field.Description
        v-else-if="part === 'description' && isShown(part)"
        :id="descriptionId"
        data-testid="description"
      >
        Description
      </Field.Description>
    </template>
  </Field.Root>
</template>
