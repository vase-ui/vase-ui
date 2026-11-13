<script setup lang="ts">
import { markChildrenMounted } from '../../internals/useRenderElement';
import StyleDisableScrollbar from '../../utils/StyleDisableScrollbar.vue';

// The server HTML must hide the native scrollbar before the page hydrates.
// The style element comes first, so that a browser reads the rule before it reads the viewport.
markChildrenMounted();
</script>

<template>
  <StyleDisableScrollbar />
  <slot />
</template>
