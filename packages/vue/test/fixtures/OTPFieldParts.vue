<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { OTPField } from '../../src/otp-field';
import StyledInput from './StyledInput.vue';

// Each part renders the element of the developer in its `element` slot: the root a `<section>`,
// the first slot a plain `<input>` and the second one a component that exposes its input.
defineProps({ root: Object as PropType<Record<string, unknown>> });
const rootPart = useTemplateRef('rootPart');
const firstPart = useTemplateRef('firstPart');
const secondPart = useTemplateRef('secondPart');
defineExpose({ root: rootPart, first: firstPart, second: secondPart });
</script>

<template>
  <form>
    <OTPField.Root ref="rootPart" :length="2" v-bind="root">
      <template #element="{ props, elementRef, state }">
        <section v-bind="props" :ref="elementRef" :data-code="state.value">
          <OTPField.Input ref="firstPart">
            <template #element="{ props: input, elementRef: inputRef, state: slot }">
              <input v-bind="input" :ref="inputRef" :data-index="slot.index" />
            </template>
          </OTPField.Input>
          <OTPField.Input ref="secondPart">
            <template #element="{ props: input, elementRef: inputRef }">
              <StyledInput v-bind="input" :ref="inputRef" />
            </template>
          </OTPField.Input>
        </section>
      </template>
    </OTPField.Root>
  </form>
</template>
