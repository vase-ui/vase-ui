<script lang="ts">
import type {
  MenuRootActions,
  MenuRootChangeEventDetails,
  MenuRootChangeEventReason,
  MenuRootHighlightEventDetails,
  MenuRootProps,
} from '../../menu/root/MenuRoot.vue';

export interface ContextMenuRootState {}

export interface ContextMenuRootProps extends Omit<
  MenuRootProps,
  // Context Menu does not support a detached trigger. It opens from a right-click or a long press
  // on `ContextMenu.Trigger`, not from a registered trigger, so these inherited props do not apply.
  'handle' | 'triggerId' | 'defaultTriggerId' | 'modal' | 'closeParentOnEsc'
> {}

export type ContextMenuRootActions = MenuRootActions;
export type ContextMenuRootChangeEventReason = MenuRootChangeEventReason;
export type ContextMenuRootChangeEventDetails = MenuRootChangeEventDetails;
</script>

<script setup lang="ts">
import { provide, shallowRef, useTemplateRef } from 'vue';
import { useVaseUiId } from '../../internals/useBaseUiId';
import MenuRoot from '../../menu/root/MenuRoot.vue';
import { MenuRootContext } from '../../menu/root/MenuRootContext';
import { ContextMenuRootContext } from './ContextMenuRootContext';
import type { ContextMenuAnchor } from './ContextMenuRootContext';

const props = withDefaults(defineProps<ContextMenuRootProps>(), {
  defaultOpen: false,
  open: undefined,
  highlightItemOnHover: true,
  loopFocus: true,
  disabled: false,
  orientation: 'vertical',
});

const emit = defineEmits<{
  /**
   * Event handler called when the menu is opened or closed.
   */
  openChange: [open: boolean, eventDetails: ContextMenuRootChangeEventDetails];
  'update:open': [open: boolean];
  /**
   * Event handler called after any animations complete when the menu is opened or closed.
   */
  openChangeComplete: [open: boolean];
  /**
   * Callback fired when an item is highlighted or unhighlighted.
   * Receives the highlighted item element (or `undefined` if no item is highlighted) and details
   * containing the reason for the change, the event, and the item's text label.
   * The `reason` can be:
   * - `'keyboard'`: the highlight changed due to keyboard navigation.
   * - `'pointer'`: the highlight changed due to pointer hovering. The event may be a `MouseEvent`
   *   rather than a `PointerEvent`.
   * - `'none'`: the highlight changed for another reason, such as automatic highlighting while
   *   filtering, the item list changing, or the popup opening or closing.
   */
  itemHighlighted: [
    highlightedItem: HTMLElement | undefined,
    eventDetails: MenuRootHighlightEventDetails,
  ];
}>();

defineSlots<{
  /**
   * The content of the context menu.
   */
  default(): unknown;
}>();

const anchor = shallowRef<ContextMenuAnchor>({
  getBoundingClientRect() {
    return DOMRect.fromRect({ width: 0, height: 0, x: 0, y: 0 });
  },
});

const context: ContextMenuRootContext = {
  anchor,
  setAnchor(nextAnchor) {
    anchor.value = nextAnchor;
  },
  actionsRef: shallowRef(null),
  backdropRef: shallowRef(null),
  internalBackdropRef: shallowRef(null),
  positionerRef: shallowRef(null),
  allowMouseUpTriggerRef: shallowRef(true),
  initialCursorPointRef: shallowRef(null),
  rootId: useVaseUiId(),
};

provide(ContextMenuRootContext, context);
// Without this value, a menu above the root makes the menu of the root a plain menu.
provide(MenuRootContext, undefined);

const menuRootRef = useTemplateRef<ContextMenuRootActions>('menuRoot');

defineExpose<ContextMenuRootActions>({
  unmount: () => menuRootRef.value?.unmount(),
  close: () => menuRootRef.value?.close(),
});
</script>

<template>
  <MenuRoot
    ref="menuRoot"
    :default-open="props.defaultOpen"
    :open="props.open"
    :highlight-item-on-hover="props.highlightItemOnHover"
    :loop-focus="props.loopFocus"
    :disabled="props.disabled"
    :orientation="props.orientation"
    @open-change="(open, details) => emit('openChange', open, details)"
    @update:open="(open) => emit('update:open', open)"
    @open-change-complete="(open) => emit('openChangeComplete', open)"
    @item-highlighted="(item, details) => emit('itemHighlighted', item, details)"
  >
    <slot />
  </MenuRoot>
</template>
