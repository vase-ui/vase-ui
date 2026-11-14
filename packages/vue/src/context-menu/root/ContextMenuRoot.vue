<script lang="ts">
import type {
  MenuRootActions,
  MenuRootChangeEventDetails,
  MenuRootChangeEventReason,
  MenuRootHighlightEventDetails,
  MenuRootOrientation,
} from '../../menu/root/MenuRoot.vue';

export interface ContextMenuRootState {}

export interface ContextMenuRootProps {
  /**
   * Whether the menu is initially open.
   *
   * To render a controlled menu, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether the menu is currently open.
   */
  open?: boolean | undefined;
  /**
   * Whether moving the pointer over items should highlight them.
   * Disabling this prop allows CSS `:hover` to be differentiated from the `:focus` (`data-highlighted`) state.
   * @default true
   */
  highlightItemOnHover?: boolean | undefined;
  /**
   * Whether to loop keyboard focus back to the first item
   * when the end of the list is reached while using the arrow keys.
   * @default true
   */
  loopFocus?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * The visual orientation of the menu.
   * Controls whether roving focus uses up/down or left/right arrow keys.
   * @default 'vertical'
   */
  orientation?: MenuRootOrientation | undefined;
}

export type ContextMenuRootActions = MenuRootActions;
export type ContextMenuRootChangeEventReason = MenuRootChangeEventReason;
export type ContextMenuRootChangeEventDetails = MenuRootChangeEventDetails;
</script>

<script setup lang="ts">
import { provide, shallowRef } from 'vue';
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

const menuRoot = shallowRef<ContextMenuRootActions | null>(null);

defineExpose<ContextMenuRootActions>({
  unmount: () => menuRoot.value?.unmount(),
  close: () => menuRoot.value?.close(),
});
</script>

<template>
  <MenuRoot
    :ref="(root: unknown) => (menuRoot = root as ContextMenuRootActions | null)"
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
