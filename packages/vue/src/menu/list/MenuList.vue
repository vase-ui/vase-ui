<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface MenuListState {}

export interface MenuListProps
  extends
    VaseUIComponentProps<MenuListState>,
    /* @vue-ignore */ WithVaseUIEvent<Omit<HTMLAttributes, 'id'>> {
  /**
   * The id of the list. The active trigger of the menu uses it for `aria-controls`.
   */
  id?: string | undefined;
}
</script>

<script setup lang="ts">
import { EMPTY_OBJECT } from '../../common/empty';
import { resolvePopupLabel } from '../../internals/resolvePopupLabel';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { createElementSetter, stateElementTarget } from '../../utils/popups/createElementSetter';
import { useMenuFilterImpl } from '../filter-root/MenuFilterContext';
import { useMenuRootContext } from '../root/MenuRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuListProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: MenuListState }): unknown;
  render: ComponentRenderFn<HTMLProps, MenuListState>;
}>();

const { store, orientation, popupLabelId } = useMenuRootContext();

// In a filterable menu the popup is the dialog that holds the input, and the input points at the
// list with `aria-controls`. The filter gives the list its id and its label, and the list hands the
// keys that land on it back to the input.
const filterList = useMenuFilterImpl()?.useList({ id: () => props.id });

const listId = useVaseUiId(() => props.id);

const state: MenuListState = EMPTY_OBJECT;

function getListProps(attrs: Record<string, any>) {
  return [
    {
      id: listId.value,
      role: 'menu',
      // The list holds the `menu` role, so it can take the focus in place of the popup.
      tabindex: -1,
      // `menu` is implicitly vertical, so only the non-default value needs to be rendered.
      'aria-orientation': orientation.value === 'horizontal' ? 'horizontal' : undefined,
      'aria-labelledby': resolvePopupLabel(attrs, popupLabelId.value),
    },
    attrs,
  ];
}

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement<
  MenuListState,
  HTMLElement
>('div', props, {
  state,
  ref: filterList ? filterList.ref : createElementSetter(stateElementTarget(store, 'listElement')),
  props: (attrs) => (filterList ? filterList.props(attrs) : getListProps(attrs)),
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
