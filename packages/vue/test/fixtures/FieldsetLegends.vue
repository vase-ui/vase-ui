<script setup lang="ts">
import type { PropType } from 'vue';
import { Fieldset } from '../../src/fieldset';

// `legend` is the place of the legend: none, in a wrapper, a native `<legend>` in the `element`
// slot or in `as`, or two legends. With `first: false`, the first of two legends goes.
defineProps({
  scene: {
    type: Object as PropType<{
      legend: 'none' | 'wrapped' | 'native' | 'as' | 'two';
      first?: boolean;
    }>,
    required: true,
  },
  root: Object as PropType<Record<string, unknown>>,
});
</script>

<template>
  <Fieldset.Root v-bind="root">
    <div v-if="scene.legend === 'wrapped'">
      <Fieldset.Legend>Billing</Fieldset.Legend>
    </div>
    <Fieldset.Legend v-else-if="scene.legend === 'native'">
      <template #element="{ props, elementRef }">
        <legend v-bind="props" :ref="elementRef">Billing</legend>
      </template>
    </Fieldset.Legend>
    <Fieldset.Legend v-else-if="scene.legend === 'as'" as="legend">Billing</Fieldset.Legend>
    <template v-else-if="scene.legend === 'two'">
      <Fieldset.Legend v-if="scene.first !== false" class="first">Billing</Fieldset.Legend>
      <Fieldset.Legend class="second">Invoice</Fieldset.Legend>
    </template>
    <label>Company <input /></label>
  </Fieldset.Root>
</template>
