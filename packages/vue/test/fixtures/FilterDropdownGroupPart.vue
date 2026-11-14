<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../src/internals/types';

export interface FilterDropdownGroupPartState {
  /** Whether the query hides each item of the group. */
  hidden: boolean;
}

export interface FilterDropdownGroupPartProps
  extends
    VaseUIComponentProps<FilterDropdownGroupPartState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useFilterDropdownGroup } from '../../src/filter-dropdown/group/useFilterDropdownGroup';
import type { ComponentRenderFn, HTMLProps } from '../../src/internals/types';
import { useRenderElement } from '../../src/internals/useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<FilterDropdownGroupPartProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: FilterDropdownGroupPartState }): unknown;
  render: ComponentRenderFn<HTMLProps, FilterDropdownGroupPartState>;
}>();

// A group of a menu-shaped host. The query hides it with its items.
const { hidden } = useFilterDropdownGroup();

const state = computed<FilterDropdownGroupPartState>(() => ({ hidden: hidden.value }));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [{ role: 'group', hidden: hidden.value || undefined }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
