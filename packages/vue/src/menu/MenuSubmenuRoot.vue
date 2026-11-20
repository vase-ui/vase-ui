<script setup lang="ts">
import { useMenuRoot } from './root';
import type {
  MenuRootChangeEventDetails,
  MenuRootHighlightEventDetails,
  MenuSubmenuRootProps,
} from './types';

const props = withDefaults(defineProps<MenuSubmenuRootProps>(), {
  open: undefined,
  defaultOpen: false,
  disabled: false,
  orientation: 'vertical',
  loopFocus: true,
  highlightItemOnHover: true,
  closeParentOnEsc: false,
});
const emit = defineEmits<{
  /** The submenu opens or closes. `details.cancel()` keeps it as it was. */
  openChange: [open: boolean, details: MenuRootChangeEventDetails];
  /** Comes after `openChange`, unless a listener cancels the change. `v-model:open` uses it. */
  'update:open': [open: boolean];
  /** The highlighted item changes. It gets the element of the item, or `undefined`. */
  itemHighlighted: [element: HTMLElement | undefined, details: MenuRootHighlightEventDetails];
}>();
defineSlots<{
  /** The trigger and the portal of the submenu. */
  default?(): unknown;
}>();

const { close } = useMenuRoot(props, emit, 'submenu');

defineExpose({ close });
</script>

<template>
  <slot />
</template>
