<script setup lang="ts">
import { useMenuRoot } from './root';
import type { MenuSubmenuRootEmits, MenuSubmenuRootProps } from './types';

const props = withDefaults(defineProps<MenuSubmenuRootProps>(), {
  open: undefined,
  defaultOpen: false,
  disabled: false,
  orientation: 'vertical',
  loopFocus: true,
  highlightItemOnHover: true,
  closeParentOnEsc: false,
});
const emit = defineEmits<MenuSubmenuRootEmits>();
defineSlots<{
  /** The trigger and the portal of the submenu. */
  default?(): unknown;
}>();

const { close } = useMenuRoot(props, emit, 'submenu');

defineExpose({
  /** Closes the submenu. */
  close,
});
</script>

<template>
  <slot />
</template>
