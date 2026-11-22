<script setup lang="ts">
import { usePopupPortal } from '../popup/portal';
import { injectComboboxRoot, providePortal } from './root';
import type { ComboboxPortalProps } from './types';

const props = withDefaults(defineProps<ComboboxPortalProps>(), {
  to: undefined,
  disabled: false,
  defer: false,
  keepMounted: false,
});
defineSlots<{ default?(): unknown }>();

const context = injectComboboxRoot('Portal');
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
    return props.keepMounted || context.keepsPopup;
  },
});
providePortal();
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
