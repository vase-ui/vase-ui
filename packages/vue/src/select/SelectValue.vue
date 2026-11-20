<script setup lang="ts">
import { computed, mergeProps, useAttrs, watch } from 'vue';
import { useElement } from '../common/element';
import {
  hasNullItemLabel,
  resolveMultipleLabels,
  resolveSelectedLabel,
  type ItemLabel,
} from '../internals/resolveValueLabel';
import { injectSelectRoot } from './root';
import type { SelectValueProps, SelectValueState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<SelectValueProps>();
defineSlots<{
  /** The content in place of the label of the value. */
  default?(scope: { value: any; state: SelectValueState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: SelectValueState;
  }): unknown;
}>();

const context = injectSelectRoot('Value');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
watch(
  element,
  (span, _, onCleanup) => {
    if (!span) return;
    context.valueElement.value = span;
    onCleanup(() => {
      if (context.valueElement.value === span) context.valueElement.value = null;
    });
  },
  { flush: 'sync', immediate: true },
);

const state = computed<SelectValueState>(() => ({
  value: context.value,
  placeholder: !context.hasValue,
}));

/** The labels of the value, or the placeholder. */
const labels = computed<NonNullable<ItemLabel>[]>(() => {
  if (!context.hasValue && props.placeholder != null && !hasNullItemLabel(context.items)) {
    return props.placeholder === '' ? [] : [props.placeholder];
  }
  const resolved = context.multiple
    ? resolveMultipleLabels(context.value as unknown[], context.items, context.itemToStringLabel)
    : [resolveSelectedLabel(context.value, context.items, context.itemToStringLabel)];
  // An empty text would leave an empty text node in the element.
  return resolved.filter((label) => label !== '');
});

function elementProps() {
  return mergeProps({ 'data-placeholder': state.value.placeholder ? '' : undefined }, attrs);
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
    <slot :value="state.value" :state="state">
      <template v-for="(label, index) in labels" :key="index">
        <component :is="label" v-if="typeof label === 'function'" />
        <template v-else>{{ label }}</template>
      </template>
    </slot>
  </component>
  <span v-else v-bind="elementProps()" :ref="setElement">
    <slot :value="state.value" :state="state">
      <template v-for="(label, index) in labels" :key="index">
        <component :is="label" v-if="typeof label === 'function'" />
        <template v-else>{{ label }}</template>
      </template>
    </slot>
  </span>
</template>
