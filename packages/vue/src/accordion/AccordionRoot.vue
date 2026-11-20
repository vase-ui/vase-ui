<script setup lang="ts" generic="Value = any">
import { computed, mergeProps, provide, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { useModel } from '../common/model';
import { accordionRootKey } from './item';
import type {
  AccordionRootChangeEventDetails,
  AccordionRootProps,
  AccordionRootState,
  AccordionValue,
} from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<AccordionRootProps<Value>>(), {
  modelValue: undefined,
  defaultValue: undefined,
  multiple: false,
  disabled: false,
  keepMounted: false,
  hiddenUntilFound: false,
});
const emit = defineEmits<{
  /**
   * The user opens or closes an item: `trigger-press` for a press of a trigger, `none` for a reveal
   * by find-in-page. The `openChange` of the item comes first. `details.cancel()` keeps the value as
   * it is.
   */
  valueChange: [value: AccordionValue<Value>, details: AccordionRootChangeEventDetails];
  /** Comes after `valueChange`, unless a listener cancels the change. `v-model` uses it. */
  'update:modelValue': [value: AccordionValue<Value>];
}>();
defineSlots<{
  default?(scope: { state: AccordionRootState<Value> }): unknown;
  element?(scope: ElementSlotProps<AccordionRootState<Value>>): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const { value: model, setOwn } = useModel(() => props.modelValue, props.defaultValue ?? null);
const value = computed<AccordionValue<Value>>(() => model.value ?? []);
const state = computed<AccordionRootState<Value>>(() => ({
  value: value.value,
  disabled: props.disabled,
}));

provide(accordionRootKey, {
  get value() {
    return value.value;
  },
  get disabled() {
    return props.disabled;
  },
  get keepMounted() {
    return props.keepMounted;
  },
  get hiddenUntilFound() {
    return props.hiddenUntilFound;
  },
  change(itemValue, open, details) {
    const list = value.value;
    let next: AccordionValue<Value>;
    if (!props.multiple) next = open ? [itemValue as Value] : [];
    // Not `concat`, which flattens a value that is an array.
    else if (open) next = [...list, itemValue as Value];
    else next = list.filter((entry) => entry !== itemValue);
    emit('valueChange', next, details);
    if (details.isCanceled) return;
    setOwn(next);
    emit('update:modelValue', next);
  },
});

defineExpose({ element });

function elementProps() {
  return mergeProps({ 'data-disabled': props.disabled ? '' : undefined }, attrs);
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
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
