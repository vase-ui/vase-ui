<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { FilterDropdownEmptyState } from '../../src/filter-dropdown/empty/FilterDropdownEmpty';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../src/internals/types';

export interface FilterDropdownEmptyPartProps
  extends
    VaseUIComponentProps<FilterDropdownEmptyState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { EMPTY_OBJECT } from '../../src/common/empty';
import { useFilterDropdownEmpty } from '../../src/filter-dropdown/empty/FilterDropdownEmpty';
import type { ComponentRenderFn, HTMLProps } from '../../src/internals/types';
import { useRenderElement } from '../../src/internals/useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<FilterDropdownEmptyPartProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: FilterDropdownEmptyState }): unknown;
  render: ComponentRenderFn<HTMLProps, FilterDropdownEmptyState>;
}>();

const state: FilterDropdownEmptyState = EMPTY_OBJECT;

const { visible, ref: emptyRef, props: emptyProps } = useFilterDropdownEmpty();

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: emptyRef,
  props: emptyProps,
});

defineExpose({ element });
</script>

<template>
  <template v-if="visible">
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
    <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
  </template>
</template>
