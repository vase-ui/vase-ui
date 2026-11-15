<script setup lang="ts">
import { useTemplateRef } from 'vue';
import type { VaseUIChangeEventDetails } from '../../src/internals/createBaseUIEventDetails';
import { useFloatingRootStore } from '../../src/utils/popups/floating-root/useFloatingRootStore';
import { useFloatingFocusManager } from '../../src/utils/popups/focus/FloatingFocusManager';

// A focus manager with a store of its own, for the tests of the portal. The props are the state
// that a popup part gives through its store. The store has no popup element, and the guards go
// beside the `div`.
const props = withDefaults(
  defineProps<{
    open?: boolean | undefined;
    modal?: boolean | undefined;
    closeOnFocusOut?: boolean | undefined;
    domReference?: Element | null | undefined;
    nextFocusableElement?: HTMLElement | null | undefined;
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

useFloatingFocusManager(
  () => ({
    store,
    modal: props.modal,
    closeOnFocusOut: props.closeOnFocusOut,
    nextFocusableElement: props.nextFocusableElement,
    initialFocus: false,
  }),
  useTemplateRef('element'),
);
</script>

<template>
  <div ref="element"><slot /></div>
</template>
