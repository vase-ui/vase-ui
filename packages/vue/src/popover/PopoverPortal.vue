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
const portal = usePopupPortal(context.root, context.layer, props);
providePortal();
</script>

<template>
  <!-- Vue 3.5.12 removes the first children of the target when it unmounts a disabled `<Teleport>`
  that it hydrated, so a disabled portal renders no `<Teleport>`. -->
  <template v-if="portal.rendered.value && disabled">
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
  </template>
  <Teleport v-else-if="portal.rendered.value" :to="portal.target.value" :defer="defer">
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
