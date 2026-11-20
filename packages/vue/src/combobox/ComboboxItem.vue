<script setup lang="ts">
import { computed, inject, mergeProps, useAttrs, useId, watch } from 'vue';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { useListItem } from '../list/list';
import { injectComboboxRoot, rowKey } from './root';
import type { ComboboxItemProps, ComboboxItemState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxItemProps>(), {
  index: undefined,
  disabled: false,
});
defineSlots<{
  default?(scope: { state: ComboboxItemState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ComboboxItemState;
  }): unknown;
}>();

const context = injectComboboxRoot('Item');
const inRow = inject(rowKey, false);
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();

// An item with no value has the value `null`.
const value = () => (props.value === undefined ? null : props.value);
// Each value that the item reads is a primitive of its own, so a highlight step renders only the
// two items whose highlight changes (discussion #665).
const disabled = computed(() => context.disabled || props.disabled);
const selected = computed(() => context.isSelected(value()));
const { highlighted, attributes } = useListItem(context.list, element, {
  label: () => undefined,
  disabled: () => disabled.value,
});
watch(
  element,
  (el, _, onCleanup) => {
    if (!el) return;
    onCleanup(
      context.addItem(el, {
        value,
        index: () => props.index,
      }),
    );
  },
  { flush: 'post' },
);

const state = computed<ComboboxItemState>(() => ({
  disabled: disabled.value,
  selected: selected.value,
  highlighted: highlighted.value,
}));

function onClick(event: MouseEvent) {
  if (!disabled.value) context.select(value(), event);
}

function elementProps() {
  return mergeProps(
    attributes.value,
    {
      id: givenId(props.id) ?? generatedId,
      role: inRow ? 'gridcell' : 'option',
      'aria-selected': context.mode === 'none' ? undefined : selected.value ? 'true' : 'false',
      'aria-disabled': disabled.value ? 'true' : undefined,
      onClick,
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
