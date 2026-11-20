<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { NumberField } from '../../src/number-field';
import StyledInput from './StyledInput.vue';

// Parts in the `element` slot of each part, and parts in `as`.
defineProps({ root: Object as PropType<Record<string, unknown>> });
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
            <NumberField.ScrubArea as="label" for="parts-input" class="Area"
              >Amount</NumberField.ScrubArea
            >
            <NumberField.Decrement aria-label="Decrease">
              <template #default="{ state: buttonState }">{{
                buttonState.disabled ? 'off' : '−'
              }}</template>
            </NumberField.Decrement>
            <NumberField.Input id="parts-input" ref="input" aria-label="First">
              <template #element="{ props: inputProps, elementRef: inputRef }">
                <StyledInput v-bind="inputProps" :ref="inputRef" />
              </template>
            </NumberField.Input>
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
