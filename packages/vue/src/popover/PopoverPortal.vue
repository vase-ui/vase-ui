<script setup lang="ts">
import { usePopupPortal, usePortalOwner } from '../popup/portal';
import { injectPopoverRoot, providePortal } from './root';
import type { PopoverPortalProps } from './types';

const props = withDefaults(defineProps<PopoverPortalProps>(), {
  to: undefined,
  disabled: false,
  defer: false,
  keepMounted: false,
});
defineSlots<{ default?(): unknown }>();

const context = injectPopoverRoot('Portal');
const portal = usePopupPortal(context.root, context.layer, props, context.positioner);
const owner = usePortalOwner(context.root, context.layer, portal.sentinels);
providePortal();
</script>

<template>
  <span v-if="owner" :aria-owns="owner" :style="portal.sentinelStyle" />
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
