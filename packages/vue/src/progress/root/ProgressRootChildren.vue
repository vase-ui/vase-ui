<script setup lang="ts">
import { visuallyHidden } from '../../common/visuallyHidden';
import { markChildrenMounted } from '../../internals/useRenderElement';

// NVDA and JAWS announce the label of a progress bar only when the element has text.
// The hidden node gives that text. https://github.com/mui/base-ui/issues/4184
// A comment in the template would become a DOM node in a development build.
markChildrenMounted();
</script>

<template>
  <slot />
  <span role="presentation" :style="visuallyHidden">x</span>
</template>
