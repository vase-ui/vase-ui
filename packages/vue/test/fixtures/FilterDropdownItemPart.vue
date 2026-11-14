<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../src/internals/types';

export interface FilterDropdownItemPartState {}

export interface FilterDropdownItemPartProps
  extends
    VaseUIComponentProps<FilterDropdownItemPartState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /** The text that the filter matches in place of the rendered text. */
  label?: string | undefined;
  /** Whether the item keeps its group visible while the query hides the item. */
  retainGroup?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { EMPTY_OBJECT } from '../../src/common/empty';
import { FilterDropdownHiddenItemText } from '../../src/filter-dropdown/item/FilterDropdownHiddenItemText';
import { useFilterDropdownItem } from '../../src/filter-dropdown/item/useFilterDropdownItem';
import type { ComponentRenderFn, HTMLProps } from '../../src/internals/types';
import { useRenderElement } from '../../src/internals/useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<FilterDropdownItemPartProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: FilterDropdownItemPartState }): unknown;
  render: ComponentRenderFn<HTMLProps, FilterDropdownItemPartState>;
}>();

const state: FilterDropdownItemPartState = EMPTY_OBJECT;

// An item of a menu-shaped host. It renders its element only while the query keeps it.
const { visible, ref: itemRef, setHiddenText } = useFilterDropdownItem({
  label: () => props.label,
  retainGroup: () => props.retainGroup,
});

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: itemRef,
  props: (attrs) => [{ role: 'menuitem' }, attrs],
});

defineExpose({ element });
</script>

<template>
  <template v-if="visible">
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
    <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
  </template>
  <FilterDropdownHiddenItemText v-else :set-text="setHiddenText"
    ><slot :state="state"
  /></FilterDropdownHiddenItemText>
</template>
