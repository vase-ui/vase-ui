<script setup lang="ts">
import { usePopupPortal } from '../popup/portal';
import { injectDialog, provideDialogPortal } from './root';
import type { DialogPortalProps } from './types';

const props = withDefaults(defineProps<DialogPortalProps>(), {
  to: undefined,
  disabled: false,
  defer: false,
  keepMounted: false,
});
defineSlots<{ default?(): unknown }>();

const context = injectDialog('Portal');
const portal = usePopupPortal(context.root, context.layer, props);
provideDialogPortal(context);
</script>

<template>
  <Teleport
    v-if="portal.rendered.value"
    :to="portal.target.value"
    :disabled="disabled"
    :defer="defer"
  >
    <div
      v-if="portal.blocks.value"
      :ref="portal.setBlock"
      role="presentation"
      :style="portal.blockStyle.value"
      @mousedown="portal.onBlockMousedown"
    />
    <span
      v-if="portal.sentinels.value"
      :ref="portal.setBefore"
      tabindex="0"
      aria-hidden="true"
      :style="portal.sentinelStyle"
      @focus="context.focus.onSentinelFocus('before', $event)"
    />
    <slot />
    <span
      v-if="portal.sentinels.value"
      :ref="portal.setAfter"
      tabindex="0"
      aria-hidden="true"
      :style="portal.sentinelStyle"
      @focus="context.focus.onSentinelFocus('after', $event)"
    />
  </Teleport>
</template>
