<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { NumberField } from '../../src/number-field';
import StyledInput from './StyledInput.vue';

// Parts in the `element` slot of each part, a swap of the text input, and parts in `as`.
defineProps({
  root: Object as PropType<Record<string, unknown>>,
  scene: { type: Object as PropType<{ second: boolean }>, default: () => ({ second: false }) },
});
const input = useTemplateRef('input');
const increment = useTemplateRef('increment');
defineExpose({ input, increment });
</script>

<template>
  <NumberField.Root as="section" v-bind="root">
    <template #default="{ state }">
      <NumberField.Group>
        <template #element="{ props, elementRef, state: groupState }">
          <article v-bind="props" :ref="elementRef" :data-text="groupState.inputValue">
            <NumberField.ScrubArea as="label" for="parts-input" class="Area">Amount</NumberField.ScrubArea>
            <NumberField.Decrement aria-label="Decrease">
              <template #default="{ state: buttonState }">{{
                buttonState.disabled ? 'off' : '−'
              }}</template>
            </NumberField.Decrement>
            <NumberField.Input v-if="!scene.second" id="parts-input" ref="input" aria-label="First">
              <template #element="{ props: inputProps, elementRef: inputRef }">
                <StyledInput v-bind="inputProps" :ref="inputRef" />
              </template>
            </NumberField.Input>
            <NumberField.Input v-else aria-label="Second" />
            <NumberField.Increment ref="increment" aria-label="Increase">
              <template #element="{ props: buttonProps, elementRef: buttonRef }">
                <div v-bind="buttonProps" :ref="buttonRef">+</div>
              </template>
            </NumberField.Increment>
          </article>
        </template>
      </NumberField.Group>
      <output>{{ state.value }}</output>
    </template>
  </NumberField.Root>
</template>
