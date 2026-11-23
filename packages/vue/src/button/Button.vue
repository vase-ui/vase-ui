<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import { useButton } from '../common/button';
import { useAsTag, useElement, type ElementSlotProps } from '../common/element';
import type { ButtonProps, ButtonState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ButtonProps>(), {
  disabled: false,
  focusableWhenDisabled: false,
});
defineSlots<{
  default?(scope: { state: ButtonState }): unknown;
  element?(scope: ElementSlotProps<ButtonState>): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const { disabled: isDisabled, mergeAttributes } = useButton({
  element,
  tag: useAsTag(() => props.as, 'button'),
  disabled: () => props.disabled,
  focusableWhenDisabled: () => props.focusableWhenDisabled,
  type: 'button',
});
const state = computed<ButtonState>(() => ({ disabled: isDisabled.value }));

defineExpose({ element });
</script>

<!-- A server writes no content in a void element, such as an `<input>` in `as`, and the hydration
reads an empty slot as content. -->
<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="mergeAttributes({}, attrs)"
    :elementRef="setElement"
    :state="state"
  />
  <component
    :is="as"
    v-else-if="as && $slots.default"
    v-bind="mergeAttributes({}, attrs)"
    :ref="setElement"
  >
    <slot :state="state" />
  </component>
  <component :is="as" v-else-if="as" v-bind="mergeAttributes({}, attrs)" :ref="setElement" />
  <button v-else v-bind="mergeAttributes({}, attrs)" :ref="setElement">
    <slot :state="state" />
  </button>
</template>
