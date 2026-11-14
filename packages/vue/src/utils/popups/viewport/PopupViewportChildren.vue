<script setup lang="ts">
import { markChildrenMounted } from '../../../internals/useRenderElement';
import { usePopupViewportContext } from './PopupViewportContext';

const {
  currentContentKey,
  transitioning,
  showStartingStyle,
  previousContainerStyle,
  currentContainerRef,
  previousContainerRef,
} = usePopupViewportContext();

markChildrenMounted();

// The previous container has no vnode child. The composable fills it with `replaceChildren`, and
// Vue does not patch its children.
// React writes `"true"` for a bare `data-*` attribute, so `data-current` and `data-previous` have
// that value. A selector on the value then matches as in Base UI.
</script>

<template>
  <div
    v-if="transitioning"
    key="previous"
    ref="previousContainerRef"
    data-previous="true"
    inert
    :style="previousContainerStyle"
    :data-ending-style="showStartingStyle ? undefined : ''"
  />
  <div
    :key="currentContentKey"
    ref="currentContainerRef"
    data-current="true"
    :data-starting-style="transitioning && showStartingStyle ? '' : undefined"
  >
    <slot />
  </div>
</template>
