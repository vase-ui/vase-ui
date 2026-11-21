<script setup lang="ts">
import { useMenuRoot } from '../menu/root';
import type { ContextMenuRootEmits, ContextMenuRootProps } from './types';

const props = withDefaults(defineProps<ContextMenuRootProps>(), {
  open: undefined,
  defaultOpen: false,
  disabled: false,
  orientation: 'vertical',
  loopFocus: true,
  highlightItemOnHover: true,
});
const emit = defineEmits<ContextMenuRootEmits>();
defineSlots<{
  /** The trigger and the portal of the menu. */
  default?(): unknown;
}>();

const { close } = useMenuRoot(props, emit, 'context');

defineExpose({
  /** Closes the menu. */
  close,
});
</script>

<template>
  <slot />
</template>
