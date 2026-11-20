<script setup lang="ts">
import { usePopupPortal } from '../popup/portal';
import { injectTooltipRoot, providePortal } from './root';
import type { TooltipPortalProps } from './types';

const props = withDefaults(defineProps<TooltipPortalProps>(), {
  to: undefined,
  disabled: false,
  defer: false,
  keepMounted: false,
});
defineSlots<{ default?(): unknown }>();

const context = injectTooltipRoot('Portal');
const portal = usePopupPortal(context.root, context.layer, props);
providePortal();
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
