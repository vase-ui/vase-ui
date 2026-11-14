<script lang="ts">
import type { ContextMenuRootContext } from '../../internals/context-menu-root-context/ContextMenuRootContext';
import type {
  VaseUIChangeEventDetails,
  VaseUIHighlightEventDetails,
} from '../../internals/createBaseUIEventDetails';
import type { MenubarContext } from '../../internals/menubar-context/MenubarContext';
import type { REASONS } from '../../internals/reasons';
import type { MenuHandle } from '../store/MenuHandle';
import type { MenuStore } from '../store/MenuStore';
import type { MenuRootContext } from './MenuRootContext';

export interface MenuRootState {}

export interface MenuRootProps<Payload = unknown> {
  /**
   * Whether the menu is initially open.
   *
   * To render a controlled menu, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether to loop keyboard focus back to the first item
   * when the end of the list is reached while using the arrow keys.
   * @default true
   */
  loopFocus?: boolean | undefined;
  /**
   * Whether moving the pointer over items should highlight them.
   * Disabling this prop allows CSS `:hover` to be differentiated from the `:focus` (`data-highlighted`) state.
   * @default true
   */
  highlightItemOnHover?: boolean | undefined;
  /**
   * Determines if the menu enters a modal state when open.
   * - `true`: user interaction is limited to the menu: document page scroll is locked and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   *
   * On touch devices, a `true` modal blocks outside taps but leaves the page scrollable unless the popup spans nearly the full viewport width, matching native iOS behavior.
   *
   * Nested menus ignore this prop, and menus opened by hover are never modal.
   * @default true
   */
  modal?: boolean | undefined;
  /**
   * Whether the menu is currently open.
   */
  open?: boolean | undefined;
  /**
   * The visual orientation of the menu.
   * Controls whether roving focus uses up/down or left/right arrow keys.
   * @default 'vertical'
   */
  orientation?: MenuRootOrientation | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * When in a submenu, determines whether pressing the Escape key
   * closes the entire menu, or only the current child menu.
   * @default false
   */
  closeParentOnEsc?: boolean | undefined;
  /**
   * ID of the trigger that the menu is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled menu.
   * There's no need to specify this prop when the menu is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
  /**
   * ID of the trigger that the menu is associated with.
   * This is useful in conjunction with the `defaultOpen` prop to create an initially open menu.
   */
  defaultTriggerId?: string | null | undefined;
  /**
   * A handle to associate the menu with a trigger.
   * If specified, allows external triggers to control the menu's open state.
   */
  handle?: MenuHandle<Payload> | undefined;
}

export interface MenuRootActions {
  /**
   * Ends the closing phase of the menu after an externally controlled closing animation finishes.
   * Call `preventUnmountOnClose()` in `openChange` first, otherwise the menu completes closing on its own.
   * Whether it leaves the DOM is decided by `keepMounted` on the portal.
   */
  unmount: () => void;
  /**
   * Closes the menu imperatively when called.
   */
  close: () => void;
}

export type MenuRootChangeEventReason =
  | typeof REASONS.triggerHover
  | typeof REASONS.triggerFocus
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.focusOut
  | typeof REASONS.listNavigation
  | typeof REASONS.escapeKey
  | typeof REASONS.itemPress
  | typeof REASONS.closePress
  | typeof REASONS.siblingOpen
  | typeof REASONS.cancelOpen
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;

export type MenuRootChangeEventDetails = VaseUIChangeEventDetails<MenuRootChangeEventReason> & {
  /** Prevents the popup from unmounting until the `unmount` action is called. */
  preventUnmountOnClose: () => void;
};

export type MenuRootHighlightEventReason =
  typeof REASONS.keyboard | typeof REASONS.pointer | typeof REASONS.none;

export type MenuRootHighlightEventDetails = VaseUIHighlightEventDetails<
  MenuRootHighlightEventReason,
  {
    /**
     * The highlighted item's `label` prop, or its text content when the prop is not set.
     */
    label: string | undefined;
  }
>;

export type MenuRootOrientation = 'horizontal' | 'vertical';

export type MenuParent =
  | {
      type: 'menu';
      store: MenuStore<unknown>;
    }
  | {
      type: 'menubar';
      context: MenubarContext;
    }
  | {
      type: 'context-menu';
      context: ContextMenuRootContext;
    }
  | {
      type: 'nested-context-menu';
      context: ContextMenuRootContext;
      menuContext: MenuRootContext;
    }
  | {
      type: undefined;
    };
</script>

<script setup lang="ts" generic="Payload = unknown">
import { inject, provide } from 'vue';
import { MenuFilterProviderContext } from '../filter-provider/MenuFilterProviderContext';
import { useMenuRoot } from './useMenuRoot';

const props = withDefaults(defineProps<MenuRootProps<Payload>>(), {
  open: undefined,
  defaultOpen: false,
  loopFocus: true,
  highlightItemOnHover: true,
  modal: true,
  orientation: 'vertical',
  disabled: false,
  closeParentOnEsc: false,
  triggerId: undefined,
  defaultTriggerId: null,
  handle: undefined,
});

const emit = defineEmits<{
  /**
   * Event handler called when the menu is opened or closed.
   */
  openChange: [open: boolean, eventDetails: MenuRootChangeEventDetails];
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
   * The content of the menu.
   * The slot gets the `payload` of the active trigger.
   */
  default(props: { payload: Payload | undefined }): unknown;
}>();

// Only the root directly inside `Menu.FilterProvider` is filterable, so a plain
// `Menu.SubmenuRoot` inside it stays plain.
const filterProvider = inject(MenuFilterProviderContext, null);
if (filterProvider !== null) {
  provide(MenuFilterProviderContext, null);
}
const filterRoot = filterProvider?.useRoot();

const { payload, actions, context } = useMenuRoot<Payload>(props, {
  ...filterRoot?.rootOptions,
  onOpenChange(nextOpen, details) {
    emit('openChange', nextOpen, details);
    if (!details.isCanceled) {
      emit('update:open', nextOpen);
    }
  },
  onOpenChangeComplete(nextOpen) {
    emit('openChangeComplete', nextOpen);
  },
  onItemHighlighted(highlightedItem, details) {
    emit('itemHighlighted', highlightedItem, details);
  },
});

filterRoot?.provideDropdown(context);

defineExpose(actions);
</script>

<template>
  <slot :payload="payload" />
</template>
