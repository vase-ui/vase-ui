<script setup lang="ts">
import { visuallyHidden } from '../common/visuallyHidden';
import { hasContent } from './label';
import { useToastProvider } from './provider';
import type { ToastProviderProps } from './types';

const props = withDefaults(defineProps<ToastProviderProps>(), {
  timeout: 5000,
  limit: 3,
  toastManager: undefined,
});
defineSlots<{ default?(): unknown }>();

const { alertTarget, alerts } = useToastProvider(props);
</script>

<template>
  <slot />
  <Teleport v-if="alertTarget && alerts.length > 0" :to="alertTarget">
    <div
      v-for="toast in alerts"
      :key="toast.id"
      role="alert"
      aria-atomic="true"
      :style="visuallyHidden"
    >
      <div>
        <component :is="toast.title" v-if="typeof toast.title === 'function'" />
        <template v-else-if="hasContent(toast.title)">{{ toast.title }}</template>
      </div>
      <div>
        <component :is="toast.description" v-if="typeof toast.description === 'function'" />
        <template v-else-if="hasContent(toast.description)">{{ toast.description }}</template>
      </div>
    </div>
  </Teleport>
</template>
