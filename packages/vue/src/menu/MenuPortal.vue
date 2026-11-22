<script setup lang="ts">
import { inject } from 'vue';
import { menubarKey } from '../menubar/menu';
import { usePopupPortal, usePortalOwner } from '../popup/portal';
import { injectMenu, providePortal } from './root';
import type { MenuPortalProps } from './types';

const props = withDefaults(defineProps<MenuPortalProps>(), {
  to: undefined,
  disabled: false,
  defer: false,
  keepMounted: false,
});
defineSlots<{ default?(): unknown }>();

const context = injectMenu('Portal');
const portal = usePopupPortal(context.root, context.layer, props);
const owner = usePortalOwner(context.root, context.layer, portal.sentinels);
// In a menu or a menubar, WAI-ARIA allows a child of the role `group` and not a plain element.
const inMenu = context.kind === 'submenu' || !!inject(menubarKey, null);
providePortal();
</script>

<template>
  <span
    v-if="owner"
    :role="inMenu ? 'group' : undefined"
    :aria-owns="owner"
    :style="portal.sentinelStyle"
  />
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
