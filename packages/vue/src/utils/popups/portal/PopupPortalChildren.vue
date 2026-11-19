<script setup lang="ts">
import { markChildrenMounted } from '../../../internals/useRenderElement';

defineSlots<{
  default?(): unknown;
}>();

// The portal element has no node of its own. A part that renders the portal and has nodes of its
// own, such as `Dialog.Portal`, gives its own `children` to the `#render` slot.
markChildrenMounted();
</script>

<template>
  <slot />
</template>
