<script setup lang="ts">
import { computed, mergeProps, provide, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { fieldsetKey, useInDisabledFieldset } from './part';
import { legendKey } from './root';
import type { FieldsetRootProps, FieldsetRootState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<FieldsetRootProps>();
defineSlots<{
  default?(scope: { state: FieldsetRootState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: FieldsetRootState;
  }): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const inDisabledFieldset = useInDisabledFieldset(element);
const state = computed<FieldsetRootState>(() => ({
  disabled: props.disabled || inDisabledFieldset.value,
}));

provide(fieldsetKey, {
  get disabled() {
    return state.value.disabled;
  },
});
provide(legendKey, {
  get disabled() {
    return inDisabledFieldset.value;
  },
});

defineExpose({ element });

function elementProps() {
  // CSS `:disabled` matches a `<fieldset>`. Another element that the developer renders shows the
  // state as an attribute.
  const fieldset = !element.value || element.value instanceof HTMLFieldSetElement;
  return mergeProps(
    {
      disabled: props.disabled,
      'data-disabled': !fieldset && state.value.disabled ? '' : undefined,
    },
    attrs,
  );
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <fieldset v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </fieldset>
</template>
