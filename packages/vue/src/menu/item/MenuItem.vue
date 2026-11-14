<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  NonNativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';

export interface MenuItemState {
  /**
   * Whether the item should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
}

export interface MenuItemProps
  extends
    NonNativeButtonProps,
    VaseUIComponentProps<MenuItemState>,
    /* @vue-ignore */ WithVaseUIEvent<Omit<HTMLAttributes, 'id'>> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Overrides the text used for keyboard text navigation and filtering.
   * Falls back to the rendered text when not provided.
   */
  label?: string | undefined;
  /**
   * @ignore
   */
  id?: string | undefined;
  /**
   * Whether to close the menu when the item is clicked.
   *
   * @default true
   */
  closeOnClick?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { useMenuFilterItem } from '../filter-root/MenuFilterContext';
import { useMenuRootContext } from '../root/MenuRootContext';
import { REGULAR_ITEM, useMenuItem } from './useMenuItem';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuItemProps>(), {
  as: 'div',
  nativeButton: false,
  disabled: false,
  closeOnClick: true,
});

defineSlots<{
  default(props: { state: MenuItemState }): unknown;
  render: ComponentRenderFn<HTMLProps, MenuItemState>;
}>();

const { store } = useMenuRootContext();

const listItem = useCompositeListItem({ label: () => props.label });
// A filterable menu hides the element of an item that the query filters out. The template then
// gives the content of the item to a component that reads its text and renders nothing.
const filterItem = useMenuFilterItem({ label: () => props.label });
const itemId = useVaseUiId(() => props.id);

const highlighted = computed(() => store.select('isActive', listItem.index.value));
const disabled = computed(() => props.disabled || store.select('disabled'));

const { getItemProps, itemRef } = useMenuItem({
  closeOnClick: () => props.closeOnClick,
  disabled,
  highlighted,
  id: itemId,
  store,
  nativeButton: () => props.nativeButton,
  itemMetadata: REGULAR_ITEM,
});

const state = computed<MenuItemState>(() => ({
  disabled: disabled.value,
  highlighted: highlighted.value,
}));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [itemRef, listItem.ref, filterItem.ref],
  props: (attrs) => [store.select('itemProps'), attrs, getItemProps],
});

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="filterItem.visible.value && $slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else-if="filterItem.visible.value" v-bind="elementProps()"><slot :state="state" /></component>
  <component :is="filterItem.HiddenItemText" v-else :set-text="filterItem.setHiddenText">
    <slot v-if="$slots.render" name="render" :props="{} as HTMLProps" :state="state" />
    <slot v-else :state="state" />
  </component>
</template>
