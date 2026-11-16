<script setup lang="ts">
import { onMounted, shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';

defineProps<{
  defaultValue: string | null;
  laterRemovedAtMount?: boolean | undefined;
}>();

const isMounted = shallowRef(false);
onMounted(() => {
  isMounted.value = true;
});
</script>

<template>
  <Field.Root data-testid="field">
    <RadioGroup data-testid="group" :default-value="defaultValue">
      <Radio.Root data-testid="none" :value="null" />
      <Radio.Root data-testid="a" value="a" />
      <Radio.Root data-testid="b" value="b" />
      <Radio.Root data-testid="c" value="c" />
    </RadioGroup>
    <template v-if="!(laterRemovedAtMount && isMounted)">
      <Field.Label id="label-a" data-testid="label">Fruit</Field.Label>
      <Field.Description id="desc-a" data-testid="description">Pick one.</Field.Description>
    </template>
  </Field.Root>
</template>
