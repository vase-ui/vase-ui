<script setup lang="ts">
import type { VaseUIChangeEventDetails } from '../../src/internals/createBaseUIEventDetails';
import { useFloatingRootStore } from '../../src/utils/popups/floating-root/useFloatingRootStore';
import FloatingFocusManager from '../../src/utils/popups/focus/FloatingFocusManager.vue';

// A focus manager with a store of its own, for the tests of the portal. The props are the state
// that a popup part gives through its store.
const props = withDefaults(
  defineProps<{
    open?: boolean | undefined;
    modal?: boolean | undefined;
    closeOnFocusOut?: boolean | undefined;
    domReference?: Element | null | undefined;
  }>(),
  { open: true, modal: false, closeOnFocusOut: true, domReference: null },
);

const emit = defineEmits<{
  openChange: [open: boolean, eventDetails: VaseUIChangeEventDetails<string>];
}>();

const store = useFloatingRootStore({
  open: () => props.open,
  onOpenChange: (open, eventDetails) => emit('openChange', open, eventDetails),
  elements: { anchor: () => props.domReference },
});
</script>

<template>
  <FloatingFocusManager
    :store="store"
    :modal="modal"
    :close-on-focus-out="closeOnFocusOut"
    :initial-focus="false"
  >
    <slot />
  </FloatingFocusManager>
</template>
