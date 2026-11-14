<script lang="ts">
import type { AnchorHTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface MenuLinkItemState {
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
}

export interface MenuLinkItemProps
  extends
    VaseUIComponentProps<MenuLinkItemState>,
    /* @vue-ignore */ WithVaseUIEvent<Omit<AnchorHTMLAttributes, 'id'>> {
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
   * @default false
   */
  closeOnClick?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { mergeProps } from '../../merge-props';
import { REGULAR_ITEM } from '../item/useMenuItem';
import { useMenuItemCommonProps } from '../item/useMenuItemCommonProps';
import { useMenuFilterItem } from '../filter-root/MenuFilterContext';
import { useMenuRootContext } from '../root/MenuRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuLinkItemProps>(), {
  as: 'a',
  closeOnClick: false,
});

defineSlots<{
  default(props: { state: MenuLinkItemState }): unknown;
  render: ComponentRenderFn<HTMLProps & AnchorHTMLAttributes, MenuLinkItemState>;
}>();

const { store } = useMenuRootContext();

// Vue calls the ref of a part during the render of that part. A reactive write there would make
// the render depend on it, so this is a plain variable.
let linkElement: HTMLElement | null = null;

const listItem = useCompositeListItem({ label: () => props.label });
// A filterable menu hides the element of an item that the query filters out. The template then
// gives the content of the item to a component that reads its text and renders nothing.
const filterItem = useMenuFilterItem({ label: () => props.label });
const itemId = useVaseUiId(() => props.id);

const highlighted = computed(() => store.select('isActive', listItem.index.value));

const { getButtonProps, buttonRef } = useButton({
  native: false,
  composite: true,
});

const commonProps = useMenuItemCommonProps({
  closeOnClick: () => props.closeOnClick,
  highlighted,
  id: itemId,
  store,
  typingRef: store.context.typingRef,
  getItemElement: () => linkElement,
  itemMetadata: REGULAR_ITEM,
});

function getItemProps(externalProps?: Record<string, any>) {
  return mergeProps<'a'>(commonProps.value, externalProps, getButtonProps);
}

const state = computed<MenuLinkItemState>(() => ({ highlighted: highlighted.value }));

const { element, elementProps } = useRenderElement('a', props, {
  state,
  ref: [
    (link) => {
      linkElement = link;
    },
    buttonRef,
    listItem.ref,
    filterItem.ref,
  ],
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
