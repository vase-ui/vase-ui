<script setup lang="ts">
import { usePopupPortal } from '../popup/portal';
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
const portal = usePopupPortal(context.root, context.layer, props, {
  takesFocus: () => !context.hoverOpen,
});
providePortal();
</script>

<template>
  <Teleport v-if="portal.rendered.value" :to="portal.target.value" :disabled :defer>
    <div
      v-if="portal.blocks.value"
      :ref="portal.setBlock"
      role="presentation"
      :style="portal.blockStyle.value"
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
