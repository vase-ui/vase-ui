<script setup lang="ts">
import { usePopupPortal } from '../popup/portal';
import { injectPreviewCardRoot, providePortal } from './root';
import type { PreviewCardPortalProps } from './types';

const props = withDefaults(defineProps<PreviewCardPortalProps>(), {
  to: undefined,
  disabled: false,
  defer: false,
  keepMounted: false,
});
defineSlots<{ default?(): unknown }>();

const context = injectPreviewCardRoot('Portal');
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
