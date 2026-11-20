<script setup lang="ts">
import { usePortalTarget } from '../popup/portal';
import type { ToastPortalProps } from './types';

const props = withDefaults(defineProps<ToastPortalProps>(), {
  to: undefined,
  disabled: false,
  defer: false,
});
defineSlots<{ default?(): unknown }>();

const portal = usePortalTarget(props);
</script>

<template>
  <Teleport
    v-if="portal.rendered.value"
    :to="portal.target.value"
    :disabled="disabled"
    :defer="defer"
  >
    <slot />
  </Teleport>
</template>
