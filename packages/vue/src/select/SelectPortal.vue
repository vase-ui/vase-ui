<script setup lang="ts">
import { usePopupPortal, usePortalOwner } from '../popup/portal';
import { injectSelectRoot, providePortal } from './root';
import type { SelectPortalProps } from './types';

const props = withDefaults(defineProps<SelectPortalProps>(), {
  to: undefined,
  disabled: false,
  defer: false,
});
defineSlots<{ default?(): unknown }>();

const context = injectSelectRoot('Portal');
// The content stays from the first focus of the trigger, the first open or the first fill: a key
// on the closed trigger, a fill and an item that leaves need the items.
const portal = usePopupPortal(context.root, context.layer, {
  get to() {
    return props.to;
  },
  get disabled() {
    return props.disabled;
  },
  get defer() {
    return props.defer;
  },
  get keepMounted() {
    return context.kept;
  },
});
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
