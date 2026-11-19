<script setup lang="ts">
import type { PropType } from 'vue';
import { Field } from '../../src/field';
import { Fieldset } from '../../src/fieldset';
import { Input } from '../../src/input';

// With `native`, the outer fieldset is a native `<fieldset>`.
defineProps({
  scene: { type: Object as PropType<{ outer: boolean; inner: boolean }>, required: true },
  native: Boolean,
});
</script>

<template>
  <fieldset v-if="native" id="outer" :disabled="scene.outer">
    <Fieldset.Root id="inner" :disabled="scene.inner" v-slot="{ state }">
      <Fieldset.Legend>
        <Field.Root id="field-in-legend"><Input aria-label="In legend" /></Field.Root>
      </Fieldset.Legend>
      <span class="state">{{ state.disabled }}</span>
      <Field.Root id="nested-field"><Input id="nested" aria-label="Nested" /></Field.Root>
    </Fieldset.Root>
  </fieldset>
  <Fieldset.Root v-else id="outer" :disabled="scene.outer">
    <Fieldset.Root id="inner" :disabled="scene.inner" v-slot="{ state }">
      <Fieldset.Legend>
        <Field.Root id="field-in-legend"><Input aria-label="In legend" /></Field.Root>
      </Fieldset.Legend>
      <span class="state">{{ state.disabled }}</span>
      <Field.Root id="nested-field"><Input id="nested" aria-label="Nested" /></Field.Root>
    </Fieldset.Root>
  </Fieldset.Root>
</template>
