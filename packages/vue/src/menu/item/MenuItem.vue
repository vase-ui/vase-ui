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
const id = useVaseUiId(() => props.id);

const disabled = computed(() => props.disabled || store.select('disabled'));
const highlighted = computed(() => store.select('isActive', listItem.index.value));

const { getItemProps, itemRef } = useMenuItem({
  closeOnClick: () => props.closeOnClick,
  disabled,
  highlighted,
  id,
  store,
  nativeButton: () => props.nativeButton,
  nodeId: () => store.select('floatingNodeId'),
  itemMetadata: REGULAR_ITEM,
});

const state = computed<MenuItemState>(() => ({
  disabled: disabled.value,
  highlighted: highlighted.value,
}));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [store.select('itemProps'), attrs, getItemProps],
  ref: [itemRef, listItem.ref],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
