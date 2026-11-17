<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { FilterDropdownEmptyState } from '../../filter-dropdown/empty/FilterDropdownEmpty';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface MenuEmptyState extends FilterDropdownEmptyState {}

export interface MenuEmptyProps
  extends VaseUIComponentProps<MenuEmptyState>, /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { EMPTY_OBJECT } from '../../common/empty';
import { useFilterDropdownEmpty } from '../../filter-dropdown/empty/FilterDropdownEmpty';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useMenuFilterPart } from '../filter-root/MenuFilterContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuEmptyProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: MenuEmptyState }): unknown;
  render: ComponentRenderFn<HTMLProps, MenuEmptyState>;
}>();

useMenuFilterPart('Empty');

const empty = useFilterDropdownEmpty();

const state: MenuEmptyState = EMPTY_OBJECT;

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  ref: empty.ref,
  props: empty.props,
});

defineExpose({ element });
</script>

<template>
  <slot
    v-if="empty.visible.value && usesRenderSlot()"
    name="render"
    :props="elementProps()"
    :state="state"
  />
  <component :is="as" v-else-if="empty.visible.value" v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
