<script setup lang="ts">
import { useIsHydrating } from '../common/hydration';
import { useCSPContext } from '../internals/csp-context/CSPContext';
import { styleDisableScrollbar } from './styles';

// The server HTML needs this element, so that the browser hides the native scrollbar before the
// page hydrates. After the mount, the shared element of `useStyleDisableScrollbar` does this work.
// `.attr` writes the nonce as an attribute, as the server HTML does. Without it, a client render
// sets the DOM property, and the element has no `nonce` attribute.
// The text of the element must equal `styleDisableScrollbar.css`, with no white space around it.
// So the node stays on one line.
const csp = useCSPContext();
const isHydrating = useIsHydrating();
</script>

<!-- prettier-ignore -->
<template>
  <component :is="'style'" v-if="isHydrating && !csp.disableStyleElements" :nonce.attr="csp.nonce">{{ styleDisableScrollbar.css }}</component>
</template>
