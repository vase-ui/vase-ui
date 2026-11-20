<script setup lang="ts">
import type { PropType } from 'vue';
import { Checkbox } from '../../src/checkbox';
import { CheckboxGroup } from '../../src/checkbox-group';
import { Fieldset } from '../../src/fieldset';
import { Radio } from '../../src/radio';
import { RadioGroup } from '../../src/radio-group';
import { Slider } from '../../src/slider';

// The `element` slot of the root renders the group.
defineProps({
  group: { type: String as PropType<'radio' | 'checkbox' | 'slider'>, required: true },
  root: Object as PropType<Record<string, unknown>>,
});
</script>

<template>
  <Fieldset.Root v-bind="root">
    <template #element="{ props, elementRef }">
      <RadioGroup v-if="group === 'radio'" v-bind="props" :ref="elementRef" class="Group">
        <Fieldset.Legend>Storage</Fieldset.Legend>
        <label>SSD <Radio value="ssd" /></label>
      </RadioGroup>
      <CheckboxGroup
        v-else-if="group === 'checkbox'"
        v-bind="props"
        :ref="elementRef"
        class="Group"
      >
        <Fieldset.Legend>Storage</Fieldset.Legend>
        <label>SSD <Checkbox value="ssd" /></label>
      </CheckboxGroup>
      <Slider.Root v-else v-bind="props" :ref="elementRef" class="Group">
        <Fieldset.Legend>Storage</Fieldset.Legend>
        <Slider.Control>
          <Slider.Track>
            <Slider.Thumb aria-label="Size" />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
    </template>
  </Fieldset.Root>
</template>
