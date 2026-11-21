<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { Input, type InputChangeEventDetails } from '../input';
import { injectToolbar, useToolbarItem } from './item';
import type { ToolbarInputEmits, ToolbarInputProps, ToolbarInputState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToolbarInputProps>(), {
  modelValue: undefined,
  disabled: false,
  focusableWhenDisabled: true,
  readonly: false,
});
const emit = defineEmits<ToolbarInputEmits>();
defineSlots<{
  element?(scope: ElementSlotProps<ToolbarInputState>): unknown;
}>();

const toolbar = injectToolbar();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const isDisabled = computed(() => toolbar.disabled || props.disabled);
const tabindex = useToolbarItem(toolbar, element, {
  disabled: () => isDisabled.value,
  focusable: () => !isDisabled.value || props.focusableWhenDisabled,
});
const state = computed<ToolbarInputState>(() => ({
  disabled: isDisabled.value,
  focusable: props.focusableWhenDisabled,
  orientation: toolbar.orientation,
}));

defineExpose({ element });

// A disabled input that keeps the focus is read-only, so the browser refuses each edit, also a paste
// and a drop.
function itemProps() {
  const keepsFocus = isDisabled.value && props.focusableWhenDisabled;
  const own: Record<string, unknown> = {
    tabindex: tabindex.value,
    'data-orientation': toolbar.orientation,
    'aria-disabled': keepsFocus ? 'true' : undefined,
    readonly: props.readonly || keepsFocus ? '' : undefined,
    disabled: isDisabled.value && !keepsFocus ? '' : undefined,
  };
  // With no `id` or `name` on the part, an element in the slot keeps its own.
  if (props.id !== undefined) own.id = props.id;
  if (props.name !== undefined) own.name = props.name;
  return mergeProps(own, attrs);
}

function inputProps() {
  return {
    ...itemProps(),
    modelValue: props.modelValue,
    defaultValue: props.defaultValue,
    onValueChange: (value: string, details: InputChangeEventDetails) =>
      emit('valueChange', value, details),
    'onUpdate:modelValue': (value: string) => emit('update:modelValue', value),
  };
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="itemProps()"
    :elementRef="setElement"
    :state="state"
  />
  <Input v-else v-bind="inputProps()" :ref="setElement" />
</template>
