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
import { computed, shallowRef } from 'vue';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { mergeProps } from '../../merge-props';
import { useMenuItemCommonProps } from '../item/useMenuItemCommonProps';
import { REGULAR_ITEM } from '../item/useMenuItem';
import { useMenuRootContext } from '../root/MenuRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuLinkItemProps>(), { as: 'a', closeOnClick: false });

defineSlots<{
  default(props: { state: MenuLinkItemState }): unknown;
  render: ComponentRenderFn<HTMLProps, MenuLinkItemState>;
}>();

const { store } = useMenuRootContext();

const linkElement = shallowRef<HTMLElement | null>(null);

const listItem = useCompositeListItem({ label: () => props.label });
const id = useVaseUiId(() => props.id);

const highlighted = computed(() => store.select('isActive', listItem.index.value));

const { getButtonProps, buttonRef } = useButton({
  native: false,
  composite: true,
});

const commonProps = useMenuItemCommonProps({
  closeOnClick: () => props.closeOnClick,
  highlighted,
  id,
  nodeId: () => store.select('floatingNodeId'),
  store,
  typingRef: store.context.typingRef,
  itemElement: linkElement,
  itemMetadata: REGULAR_ITEM,
});

function getItemProps(externalProps?: Record<string, any>) {
  return mergeProps<'a'>(commonProps.value, externalProps ?? {}, getButtonProps);
}

const state = computed<MenuLinkItemState>(() => ({ highlighted: highlighted.value }));

const { element, elementProps } = useRenderElement('a', props, {
  state,
  props: (attrs) => [store.select('itemProps'), attrs, getItemProps],
  ref: [
    (link) => {
      linkElement.value = link;
    },
    buttonRef,
    listItem.ref,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
