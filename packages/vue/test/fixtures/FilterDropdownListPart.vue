<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { FilterDropdownListState } from '../../src/filter-dropdown/list/FilterDropdownList';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../src/internals/types';

export interface FilterDropdownListPartProps
  extends
    VaseUIComponentProps<FilterDropdownListState>,
    /* @vue-ignore */ WithVaseUIEvent<Omit<HTMLAttributes, 'id'>> {
  /** The `id` of the list. */
  id?: string | undefined;
}
</script>

<script setup lang="ts">
import { EMPTY_OBJECT } from '../../src/common/empty';
import { useFilterDropdownList } from '../../src/filter-dropdown/list/FilterDropdownList';
import { useFilterDropdownRootContext } from '../../src/filter-dropdown/root/FilterDropdownRootContext';
import { resolvePopupLabel } from '../../src/internals/resolvePopupLabel';
import type { ComponentRenderFn, HTMLProps } from '../../src/internals/types';
import { useRenderElement } from '../../src/internals/useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<FilterDropdownListPartProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: FilterDropdownListState }): unknown;
  render: ComponentRenderFn<HTMLProps, FilterDropdownListState>;
}>();

const state: FilterDropdownListState = EMPTY_OBJECT;

const { triggerId } = useFilterDropdownRootContext();
const list = useFilterDropdownList({ id: () => props.id });

// A menu-shaped host: the list has the `menu` role and the label of the trigger.
const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) =>
    list.props({
      role: 'menu',
      'aria-labelledby': resolvePopupLabel(attrs, null, triggerId.value ?? null),
      ...attrs,
    }),
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
