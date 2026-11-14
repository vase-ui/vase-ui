<script setup lang="ts">
import { markChildrenMounted } from '../../internals/useRenderElement';
import FocusGuard from '../../utils/popups/focus/FocusGuard.vue';
import { useToastViewportContext } from './ToastViewportContext';

defineSlots<{
  default?(): unknown;
}>();

const { hasFocusGuards, handleFocusGuard } = useToastViewportContext();

markChildrenMounted();
</script>

<template>
  <FocusGuard v-if="hasFocusGuards" @focusin="handleFocusGuard" />
  <slot />
  <FocusGuard v-if="hasFocusGuards" @focusin="handleFocusGuard" />
</template>
