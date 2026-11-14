<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface MenuGroupState {}

export interface MenuGroupProps
  extends VaseUIComponentProps<MenuGroupState>, /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { provide } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import { createIdRegistry } from '../../internals/labelable-provider/createIdRegistry';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useMenuFilterImpl } from '../filter-root/MenuFilterContext';
import { MenuGroupContext } from './MenuGroupContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuGroupProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: MenuGroupState }): unknown;
  render: ComponentRenderFn<HTMLProps, MenuGroupState>;
}>();

// Each label registers by source, so a label that unmounts does not clear the id of a newer one.
const labelIds = createIdRegistry();
provide(MenuGroupContext, labelIds.registerId);

// A filterable menu hides the group, label included, once the query filters out all of its items.
const filterGroup = useMenuFilterImpl()?.useGroup();

const state: MenuGroupState = EMPTY_OBJECT;

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [
    { role: 'group', 'aria-labelledby': labelIds.ids.value.at(-1) },
    attrs,
    filterGroup?.hiddenProps.value,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
