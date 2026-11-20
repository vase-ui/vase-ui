<script setup lang="ts">
import { computed, useAttrs, useSlots } from 'vue';
import { useElement } from '../common/element';
import { useButton } from './button';
import type { ButtonProps, ButtonState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ButtonProps>(), {
  disabled: false,
  focusableWhenDisabled: false,
});
defineSlots<{
  default?(scope: { state: ButtonState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ButtonState;
  }): unknown;
}>();

const attrs = useAttrs();
const slots = useSlots();
const { element, setElement } = useElement<HTMLElement>();
const { disabled: isDisabled, mergeAttributes } = useButton({
  element,
  tag: () => (typeof props.as === 'string' && !slots.element ? props.as : undefined),
  disabled: () => props.disabled,
  focusableWhenDisabled: () => props.focusableWhenDisabled,
  type: 'button',
});
const state = computed<ButtonState>(() => ({ disabled: isDisabled.value }));

defineExpose({ element });
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="mergeAttributes({}, attrs)"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="as" v-bind="mergeAttributes({}, attrs)" :ref="setElement">
    <slot :state="state" />
  </component>
  <button v-else v-bind="mergeAttributes({}, attrs)" :ref="setElement">
    <slot :state="state" />
  </button>
</template>
