<script setup lang="ts">
import { onUnmounted } from 'vue';
import { usePopupPortal } from '../popup/portal';
import { injectNavigationMenuRoot, providePortal } from './root';
import type { NavigationMenuPortalProps } from './types';

const props = withDefaults(defineProps<NavigationMenuPortalProps>(), {
  to: undefined,
  disabled: false,
  defer: false,
  keepMounted: false,
});
defineSlots<{ default?(): unknown }>();

const root = injectNavigationMenuRoot('Portal');
const portal = usePopupPortal(root.popup, root.layer, props);
providePortal();
onUnmounted(
  root.addPortal({
    get target() {
      return portal.target.value;
    },
    get sentinels() {
      return [portal.before.value, portal.after.value] as const;
    },
  }),
);
</script>

<template>
  <Teleport
    v-if="portal.rendered.value"
    :to="portal.target.value"
    :disabled="disabled"
    :defer="defer"
  >
    <span
      v-if="portal.sentinels.value"
      :ref="portal.setBefore"
      tabindex="0"
      aria-hidden="true"
      :style="portal.sentinelStyle"
      @focus="root.onSentinelFocus('before', $event)"
    />
    <slot />
    <span
      v-if="portal.sentinels.value"
      :ref="portal.setAfter"
      tabindex="0"
      aria-hidden="true"
      :style="portal.sentinelStyle"
      @focus="root.onSentinelFocus('after', $event)"
    />
  </Teleport>
</template>
