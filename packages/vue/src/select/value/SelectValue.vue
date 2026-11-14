<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { ItemLabel } from '../../internals/resolveValueLabel';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface SelectValueState {
  /**
   * The value of the currently selected item.
   */
  value: any;
  /**
   * Whether the placeholder is being displayed.
   */
  placeholder: boolean;
}

export interface SelectValueProps
  extends
    VaseUIComponentProps<SelectValueState>,
    /* @vue-ignore */ WithVaseUIEvent<Omit<HTMLAttributes, 'placeholder'>> {
  /**
   * The placeholder value to display when no value is selected.
   * This is overridden by the default slot if specified, or by a null item's label in `items`.
   * It is a string, a number, or a function that returns the content of the placeholder.
   */
  placeholder?: ItemLabel;
}
</script>

<script setup lang="ts">
import { computed, provide } from 'vue';
import type { Component } from 'vue';
import { resolveMultipleLabels, resolveSelectedLabel } from '../../internals/resolveValueLabel';
import type { HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useSelectRootContext } from '../root/SelectRootContext';
import SelectValueChildren from './SelectValueChildren.vue';
import { SelectValueContext } from './SelectValueContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectValueProps>(), { as: 'span' });

defineSlots<{
  /**
   * Formats the selected value. Treat the value as read-only: in `multiple` mode it may be a
   * shared frozen array when nothing is selected.
   */
  default?(props: { value: any; state: SelectValueState }): unknown;
  render(props: { props: HTMLProps; state: SelectValueState; children: Component }): unknown;
}>();

const store = useSelectRootContext();

const value = computed(() => store.select('selectedValue'));
const hasSelectedValue = computed(() => store.select('hasSelectedValue'));

const labels = computed<NonNullable<ItemLabel>[]>(() => {
  if (
    !hasSelectedValue.value &&
    props.placeholder != null &&
    !store.select('hasNullItemLabel', true)
  ) {
    return props.placeholder === '' ? [] : [props.placeholder];
  }

  const items = store.select('items');
  const itemToStringLabel = store.select('itemToStringLabel');
  const resolved = Array.isArray(value.value)
    ? resolveMultipleLabels(value.value, items, itemToStringLabel)
    : [resolveSelectedLabel(value.value, items, itemToStringLabel)];
  // An empty text would leave an empty text node in the element.
  return resolved.filter((label) => label !== '');
});

provide(SelectValueContext, { value, labels });

const state = computed<SelectValueState>(() => ({
  value: value.value,
  placeholder: !hasSelectedValue.value,
}));

// A compiled template can mount a new value part before it unmounts the part that it replaces.
// The old part then clears only its own element.
let ownElement: HTMLSpanElement | null = null;
function setValueElement(span: HTMLElement | null) {
  const { valueRef } = store.context;
  if (span) {
    valueRef.value = span as HTMLSpanElement;
  } else if (valueRef.value === ownElement) {
    valueRef.value = null;
  }
  ownElement = span as HTMLSpanElement | null;
}

const { element, elementProps } = useRenderElement('span', props, {
  state,
  ref: [setValueElement],
  stateAttributesMapping: { value: () => null },
  children: true,
});

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :children="SelectValueChildren" />
  <component :is="as" v-else v-bind="elementProps()"><SelectValueChildren><template v-if="$slots.default" #default="content"><slot v-bind="content" :state="state" /></template></SelectValueChildren></component>
</template>
