<script lang="ts">
import type {
  MenuRootChangeEventDetails,
  MenuRootChangeEventReason,
  MenuRootProps,
} from '../root/MenuRoot.vue';

export interface MenuSubmenuRootState {}

export interface MenuSubmenuRootProps extends Omit<
  MenuRootProps,
  'modal' | 'handle' | 'triggerId' | 'defaultTriggerId'
> {}

export type MenuSubmenuRootChangeEventReason = MenuRootChangeEventReason;
export type MenuSubmenuRootChangeEventDetails = MenuRootChangeEventDetails;
</script>

<script setup lang="ts">
import { inject, provide } from 'vue';
import { MenuFilterProviderContext } from '../filter-provider/MenuFilterProviderContext';
import type { MenuRootHighlightEventDetails } from '../root/MenuRoot.vue';
import { useMenuRootContext } from '../root/MenuRootContext';
import { useMenuRoot } from '../root/useMenuRoot';
import { MenuSubmenuRootContext } from './MenuSubmenuRootContext';

const EMPTY_SUBMENU_ROOT_CONTEXT = {};

const props = withDefaults(defineProps<MenuSubmenuRootProps>(), {
  open: undefined,
  defaultOpen: false,
  loopFocus: true,
  highlightItemOnHover: true,
  orientation: 'vertical',
  disabled: false,
  closeParentOnEsc: false,
});

const emit = defineEmits<{
  /**
   * Event handler called when the menu is opened or closed.
   */
  openChange: [open: boolean, eventDetails: MenuSubmenuRootChangeEventDetails];
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
   * The content of the submenu.
   */
  default(): unknown;
}>();

// Throws when the submenu isn't inside a menu.
useMenuRootContext();

// A provider makes only the submenu root directly inside it filterable, so a plain
// `Menu.SubmenuRoot` inside a filterable submenu stays plain.
const filterProvider = inject(MenuFilterProviderContext, null);
if (filterProvider !== null) {
  provide(MenuFilterProviderContext, null);
}
const filterRoot = filterProvider?.useSubmenuRoot();

const { actions, context } = useMenuRoot(props, {
  isSubmenu: true,
  ...filterRoot?.rootOptions,
  onOpenChange(nextOpen, details) {
    emit('openChange', nextOpen, details);
    if (!details.isCanceled) {
      emit('update:open', nextOpen);
    }
    filterRoot?.onOpenChange(nextOpen, details);
  },
  onOpenChangeComplete(nextOpen) {
    emit('openChangeComplete', nextOpen);
  },
  onItemHighlighted(highlightedItem, details) {
    emit('itemHighlighted', highlightedItem, details);
  },
});

if (filterRoot) {
  filterRoot.provideDropdown(context);
} else {
  provide(MenuSubmenuRootContext, EMPTY_SUBMENU_ROOT_CONTEXT);
}

defineExpose(actions);
</script>

<template>
  <slot />
</template>
