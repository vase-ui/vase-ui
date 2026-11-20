<script setup lang="ts">
import { computed, inject, mergeProps, onUnmounted, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { fieldKey, fieldStateAttributes } from '../field/control';
import { injectComboboxRoot, pressAroundInput } from './root';
import type { ComboboxInputGroupProps, ComboboxInputGroupState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<ComboboxInputGroupProps>();
defineSlots<{
  default?(scope: { state: ComboboxInputGroupState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ComboboxInputGroupState;
  }): unknown;
}>();

const context = injectComboboxRoot('InputGroup');
const field = inject(fieldKey, null);
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
// The group is inside the layer. The group around the input that is the control is the anchor.
// Nuxt removes `onUnmounted` from its server build, with its arguments.
const removals = [
  context.addInside(() => element.value),
  context.addInputGroup(() => element.value),
];
onUnmounted(() => {
  for (const remove of removals) remove();
});

const state = computed<ComboboxInputGroupState>(() => ({
  open: context.root.open,
  disabled: context.disabled,
  readonly: context.readonly,
  popupSide: context.popupSide,
  listEmpty: context.empty,
  placeholder: context.mode !== 'none' && !context.hasValue,
  touched: field?.state.touched ?? false,
  dirty: field?.state.dirty ?? false,
  valid: field?.state.valid ?? null,
  filled: field?.state.filled ?? false,
}));

const onMousedown = (event: MouseEvent) => pressAroundInput(context, event);

function elementProps() {
  return mergeProps(
    {
      role: 'group',
      'data-popup-open': context.root.open ? '' : undefined,
      'data-popup-side': context.popupSide ?? undefined,
      'data-list-empty': context.empty ? '' : undefined,
      'data-readonly': context.readonly ? '' : undefined,
      'data-placeholder': state.value.placeholder ? '' : undefined,
      ...fieldStateAttributes(state.value, context.disabled),
      onMousedown,
    },
    attrs,
  );
}

defineExpose({ element });
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
