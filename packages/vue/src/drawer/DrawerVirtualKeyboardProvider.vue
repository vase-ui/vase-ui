<script setup lang="ts">
import { provide } from 'vue';
import { keyboardKey, useVirtualKeyboard } from './keyboard';
import { injectDrawer } from './root';

defineSlots<{ default?(): unknown }>();

const drawer = injectDrawer('VirtualKeyboardProvider');
provide(
  keyboardKey,
  useVirtualKeyboard(() => ({
    open: drawer.dialog.root.open,
    modal: drawer.dialog.modal,
    covered: drawer.dialog.dialogsAbove > 0,
    viewport: drawer.viewport,
  })),
);
</script>

<template>
  <slot />
</template>
