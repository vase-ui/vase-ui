<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs, useId } from 'vue';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { injectComboboxRoot } from './root';
import type { ComboboxListProps, ComboboxListState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<ComboboxListProps>();
defineSlots<{
  default?(scope: { state: ComboboxListState }): unknown;
  /** Renders each item that the filter keeps. */
  item?(scope: { item: any; index: number }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ComboboxListState;
  }): unknown;
}>();

const context = injectComboboxRoot('List');
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const elementId = computed(() => givenId(props.id) ?? generatedId);
// Nuxt removes `onUnmounted` from its server build, with its arguments.
const removeList = context.setList({
  get element() {
    return element.value;
  },
  get id() {
    return elementId.value;
  },
});
onUnmounted(removeList);

const state = computed<ComboboxListState>(() => ({ empty: context.empty }));

function elementProps() {
  return mergeProps(
    {
      id: elementId.value,
      role: context.grid ? 'grid' : 'listbox',
      'aria-multiselectable': context.mode === 'multiple' ? 'true' : undefined,
      // In a grid the attribute says that the cells cannot change.
      'aria-readonly': context.readonly && !context.grid ? 'true' : undefined,
      // A press in the list keeps the focus on the input (test/measurements/combobox.test.ts, C1).
      onMousedown: (event: MouseEvent) => event.preventDefault(),
    },
    attrs,
  );
}

defineExpose({ element });
</script>

<!-- The item is the key of its nodes, so an item keeps its element when the filter moves it. A key
in the slot cannot do this: Vue compares the keys of the children of one fragment only. -->
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
    <template v-for="(item, index) in context.filteredItems" :key="item as PropertyKey">
      <slot name="item" :item="item" :index="index" />
    </template>
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
    <template v-for="(item, index) in context.filteredItems" :key="item as PropertyKey">
      <slot name="item" :item="item" :index="index" />
    </template>
  </div>
</template>
