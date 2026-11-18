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
import { computed, shallowRef, type ShallowRef } from 'vue';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeList';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button/useButton';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
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

// A filterable menu removes the element of an item that the query hides. The template then gives
// the content of the item to a component that reads its text and adds no element to the document.
const filterItem = useMenuFilterItem({ label: () => props.label });
const itemId = useVaseUiId(() => props.id);

const element: ShallowRef<HTMLElement | null> = shallowRef(null);
const listIndex = useCompositeListItem(element, { label: () => props.label });

const highlighted = computed(() => store.select('isActive', listIndex.value));

const commonProps = useMenuItemCommonProps({
  closeOnClick: () => props.closeOnClick,
  highlighted,
  id: itemId,
  store,
  typingRef: store.context.typingRef,
  getItemElement: () => element.value,
  itemMetadata: REGULAR_ITEM,
});

const state = computed<MenuLinkItemState>(() => ({ highlighted: highlighted.value }));

const { elementProps, setRef, usesRenderSlot } = useRenderElement('a', props, {
  elementRef: element,
  button: (element) =>
    useButton(element, {
      native: false,
      composite: true,
    }),
  state,
  ref: filterItem.ref,
  props: (attrs) => [commonProps.value, store.select('itemProps'), attrs],
});

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="filterItem.visible.value && usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else-if="filterItem.visible.value" v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
  <component :is="filterItem.HiddenItemText" v-else :set-text="filterItem.setHiddenText" :label="label">
    <slot v-if="$slots.render" name="render" :props="{} as HTMLProps" :state="state" />
    <slot v-else :state="state" />
  </component>
</template>
