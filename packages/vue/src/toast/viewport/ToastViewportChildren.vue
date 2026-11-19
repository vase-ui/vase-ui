<script setup lang="ts">
import { markChildrenMounted } from '../../internals/useRenderElement';
import FocusGuard from '../../utils/popups/focus/FocusGuard.vue';
import ToastLabelContent from '../utils/ToastLabelContent.vue';
import { useToastViewportContext } from '../provider/ToastProviderContext';

defineSlots<{
  default?(): unknown;
}>();

const { hasFocusGuards, handleFocusGuard, alertRegion, highPriorityToasts } =
  useToastViewportContext();

markChildrenMounted();

// The alerts are beside the viewport, not in it, because the viewport is a polite live region. A
// `Teleport` renders them in the alert region, so a label that is a function renders its component.
</script>

<template>
  <FocusGuard v-if="hasFocusGuards" @focusin="handleFocusGuard" />
  <slot />
  <FocusGuard v-if="hasFocusGuards" @focusin="handleFocusGuard" />
  <Teleport v-if="alertRegion" :to="alertRegion">
    <div v-for="toast in highPriorityToasts" :key="toast.id" role="alert" aria-atomic="true">
      <div><ToastLabelContent :label="toast.title" /></div>
      <div><ToastLabelContent :label="toast.description" /></div>
    </div>
  </Teleport>
</template>
