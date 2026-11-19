<script setup lang="ts">
import type { PropType } from 'vue';
import { Fieldset } from '../../src/fieldset';
import { Radio } from '../../src/radio';
import { RadioGroup } from '../../src/radio-group';

// With `native`, a native `<fieldset>` takes the place of the root.
defineProps({
  scene: { type: Object as PropType<{ disabled: boolean }>, required: true },
  native: Boolean,
});
</script>

<template>
  <fieldset v-if="native" :disabled="scene.disabled">
    <legend>Storage</legend>
    <RadioGroup aria-label="Storage">
      <label>SSD <Radio id="ssd" value="ssd" /></label>
    </RadioGroup>
  </fieldset>
  <Fieldset.Root v-else :disabled="scene.disabled">
    <Fieldset.Legend id="legend">Storage</Fieldset.Legend>
    <RadioGroup>
      <label>SSD <Radio id="ssd" value="ssd" /></label>
    </RadioGroup>
  </Fieldset.Root>
</template>
