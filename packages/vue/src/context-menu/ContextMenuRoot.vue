<script setup lang="ts">
import { useMenuRoot } from '../menu/root';
import type {
  ContextMenuRootChangeEventDetails,
  ContextMenuRootHighlightEventDetails,
  ContextMenuRootProps,
} from './types';

const props = withDefaults(defineProps<ContextMenuRootProps>(), {
  open: undefined,
  defaultOpen: false,
  disabled: false,
  orientation: 'vertical',
  loopFocus: true,
  highlightItemOnHover: true,
});
const emit = defineEmits<{
  /** The menu opens or closes. `details.cancel()` keeps it as it was. */
  openChange: [open: boolean, details: ContextMenuRootChangeEventDetails];
  /** Comes after `openChange`, unless a listener cancels the change. `v-model:open` uses it. */
  'update:open': [open: boolean];
  /** The highlighted item changes. It gets the element of the item, or `undefined`. */
  itemHighlighted: [
    element: HTMLElement | undefined,
    details: ContextMenuRootHighlightEventDetails,
  ];
}>();
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
