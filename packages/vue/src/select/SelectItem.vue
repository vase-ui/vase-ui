<script setup lang="ts">
import { computed, mergeProps, provide, useAttrs, watch } from 'vue';
import { useButton } from '../common/button';
import { useAsTag, useElement } from '../common/element';
import { useListItem } from '../list/list';
import { injectSelectRoot, selectItemKey } from './root';
import type { SelectItemProps, SelectItemState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectItemProps>(), { value: null, disabled: false });
defineSlots<{
  default?(scope: { state: SelectItemState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: SelectItemState;
  }): unknown;
}>();

const context = injectSelectRoot('Item');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const isDisabled = computed(() => props.disabled || context.disabled);
const button = useButton({
  element,
  disabled: () => isDisabled.value,
  focusableWhenDisabled: () => true,
  tag: useAsTag(() => props.as ?? 'div'),
});
const item = useListItem(context.list, element, {
  label: () => props.label,
  disabled: () => isDisabled.value,
});

watch(
  [element, () => props.value],
  ([el, value], _, onCleanup) => {
    if (!el) return;
    context.itemValues.set(el, value);
    onCleanup(() => context.itemValues.delete(el));
  },
  { flush: 'sync', immediate: true },
);
provide(selectItemKey, element);

const selected = computed(() => context.isSelected(props.value));
const state = computed<SelectItemState>(() => ({
  selected: selected.value,
  highlighted: item.highlighted.value,
  disabled: isDisabled.value,
}));

function elementProps() {
  const merged = button.mergeAttributes(
    {
      role: 'option',
      ...item.attributes.value,
      'aria-selected': selected.value ? 'true' : 'false',
      onKeydown(event: KeyboardEvent) {
        // Space is a character of the typeahead while a string is in progress, so it selects
        // nothing.
        if (event.key === ' ' && context.typeahead.typing) context.typeahead.onKeydown(event);
      },
      onClick(event: MouseEvent) {
        context.select(props.value, event);
      },
    },
    attrs,
  );
  // An Enter that selects closes the popup, and the focus goes back to the trigger in the keydown.
  // The default of the key would then press the trigger.
  return mergeProps(merged, {
    onKeydown(event: KeyboardEvent) {
      if (event.key === 'Enter' && !isDisabled.value) event.preventDefault();
    },
  });
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
