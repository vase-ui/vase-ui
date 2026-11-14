<script setup lang="ts">
import { h } from 'vue';
import ToastAction from '../action/ToastAction.vue';
import ToastClose from '../close/ToastClose.vue';
import ToastDescription from '../description/ToastDescription.vue';
import ToastProvider from '../provider/ToastProvider.vue';
import ToastRoot from '../root/ToastRoot.vue';
import { useToastManager } from '../useToastManager';
import ToastViewport from '../viewport/ToastViewport.vue';
import ToastViewportLabel from '../viewport/ToastViewportLabel.test.vue';
import ToastTitle from './ToastTitle.vue';

// Adds a high priority toast in `setup`, where a server render can reach it. Its title and the
// content of its action are components, so they mount in the toast and in the alert region.
const Adder = {
  setup() {
    useToastManager().add({
      id: 'saved',
      title: () => h(ToastViewportLabel),
      description: 'The file is saved.',
      priority: 'high',
      timeout: 0,
      actionProps: { children: () => h('strong', 'Undo') },
    });
    return () => null;
  },
};

const List = {
  setup() {
    const { toasts } = useToastManager();
    return () =>
      toasts.value.map((toast) =>
        h(ToastRoot, { key: toast.id, toast }, () => [
          h(ToastTitle, { 'data-testid': 'title' }),
          h(ToastDescription, { 'data-testid': 'description' }),
          h(ToastAction, { 'data-testid': 'action' }),
          h(ToastClose, { 'data-testid': 'close' }),
        ]),
      );
  },
};
</script>

<template>
  <ToastProvider>
    <Adder />
    <ToastViewport><List /></ToastViewport>
  </ToastProvider>
</template>
