<script setup lang="ts">
import { computed, inject, mergeProps, useAttrs, useId, watch } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { givenId } from '../common/id';
import { useListItem } from '../list/list';
import { injectComboboxRoot, rowKey } from './root';
import type { ComboboxItemProps, ComboboxItemState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxItemProps>(), {
  value: null,
  index: undefined,
  disabled: false,
});
defineSlots<{
  default?(scope: { state: ComboboxItemState }): unknown;
  element?(scope: ElementSlotProps<ComboboxItemState>): unknown;
}>();

const context = injectComboboxRoot('Item');
const inRow = inject(rowKey, false);
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();

// Each value that the item reads is a primitive of its own, so a highlight step renders only the
// two items whose highlight changes (discussion #665).
const isDisabled = computed(() => context.disabled || props.disabled);
const selected = computed(() => context.isSelected(props.value));
const { highlighted, attributes } = useListItem(context.list, element, {
  disabled: () => isDisabled.value,
});
watch(
  element,
  (el, _, onCleanup) => {
    if (!el) return;
    onCleanup(
      context.addItem(el, {
        value: () => props.value,
        index: () => props.index,
        disabled: () => isDisabled.value,
      }),
    );
  },
  { flush: 'post' },
);

const state = computed<ComboboxItemState>(() => ({
  disabled: isDisabled.value,
  selected: selected.value,
  highlighted: highlighted.value,
}));

function onClick(event: MouseEvent) {
  if (!isDisabled.value) context.select(props.value, event);
}

// A disabled item calls no click listener of the developer, as a disabled button does not.
function stopWhileDisabled(event: MouseEvent) {
  if (isDisabled.value) event.stopImmediatePropagation();
}

function elementProps() {
  return mergeProps(
    attributes.value,
    { onClick: stopWhileDisabled },
    {
      id: givenId(props.id) ?? generatedId,
      role: inRow ? 'gridcell' : 'option',
      'aria-selected': context.mode === 'none' ? undefined : selected.value ? 'true' : 'false',
      'aria-disabled': isDisabled.value ? 'true' : undefined,
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
