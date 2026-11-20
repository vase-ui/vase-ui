<script setup lang="ts" generic="Payload = unknown">
import { useMenuRoot } from './root';
import type {
  MenuRootChangeEventDetails,
  MenuRootHighlightEventDetails,
  MenuRootProps,
} from './types';

const props = withDefaults(defineProps<MenuRootProps<Payload>>(), {
  open: undefined,
  defaultOpen: false,
  triggerId: undefined,
  defaultTriggerId: null,
  handle: undefined,
  modal: true,
  disabled: false,
  orientation: 'vertical',
  loopFocus: true,
  highlightItemOnHover: true,
  closeParentOnEsc: false,
});
const emit = defineEmits<{
  /** The menu opens or closes. `details.cancel()` keeps it as it was. */
  openChange: [open: boolean, details: MenuRootChangeEventDetails];
  /** Comes after `openChange`, unless a listener cancels the change. `v-model:open` uses it. */
  'update:open': [open: boolean];
  /** The active trigger changes. `v-model:trigger-id` uses it. */
  'update:triggerId': [id: string | null];
  /** The highlighted item changes. It gets the element of the item, or `undefined`. */
  itemHighlighted: [element: HTMLElement | undefined, details: MenuRootHighlightEventDetails];
}>();
defineSlots<{
  /** The content of the menu. `payload` is the payload of the active trigger. */
  default?(scope: { payload: Payload | undefined }): unknown;
}>();

const { root, close } = useMenuRoot<Payload>(props, emit, 'root');

defineExpose({
  /** Closes the menu. */
  close,
});
</script>

<template>
  <slot :payload="root.payload" />
</template>
