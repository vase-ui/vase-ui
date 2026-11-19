<script setup lang="ts">
import type { PropType } from 'vue';
import { Checkbox } from '../../src/checkbox';
import { CheckboxGroup } from '../../src/checkbox-group';
import { Fieldset } from '../../src/fieldset';

// With `native`, a native `<fieldset>` takes the place of the root.
defineProps({
  scene: { type: Object as PropType<{ disabled: boolean }>, required: true },
  native: Boolean,
});
</script>

<template>
  <fieldset v-if="native" :disabled="scene.disabled">
    <legend>Apples</legend>
    <CheckboxGroup aria-label="Apples">
      <label>
        Fuji
        <Checkbox id="fuji" value="fuji">
          <template #element="{ props, elementRef, state }">
            <input
              v-bind="props"
              :ref="elementRef"
              :data-state-disabled="state.disabled || undefined"
            />
          </template>
        </Checkbox>
      </label>
    </CheckboxGroup>
    <label>
      Alone
      <Checkbox id="alone">
        <template #element="{ props, elementRef, state }">
          <input
            v-bind="props"
            :ref="elementRef"
            :data-state-disabled="state.disabled || undefined"
          />
        </template>
      </Checkbox>
    </label>
  </fieldset>
  <Fieldset.Root v-else :disabled="scene.disabled">
    <Fieldset.Legend id="legend">Apples</Fieldset.Legend>
    <CheckboxGroup>
      <label>
        Fuji
        <Checkbox id="fuji" value="fuji">
          <template #element="{ props, elementRef, state }">
            <input
              v-bind="props"
              :ref="elementRef"
              :data-state-disabled="state.disabled || undefined"
            />
          </template>
        </Checkbox>
      </label>
    </CheckboxGroup>
    <label>
      Alone
      <Checkbox id="alone">
        <template #element="{ props, elementRef, state }">
          <input
            v-bind="props"
            :ref="elementRef"
            :data-state-disabled="state.disabled || undefined"
          />
        </template>
      </Checkbox>
    </label>
  </Fieldset.Root>
</template>
