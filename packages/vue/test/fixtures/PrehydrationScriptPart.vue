<script lang="ts">
// The script shows the element before it, as the script of a part does. The text has `"` on
// purpose: a server render that interpolates the text writes `&quot;`, and the script then fails.
export const PREHYDRATION_SCRIPT_PART_SCRIPT =
  'var e=document.currentScript.previousElementSibling;e.removeAttribute("hidden");e.style.setProperty("--prehydrated","1")';
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useIsHydrating } from '../../src/common/hydration';
import { CSPProvider } from '../../src/csp-provider';
import PrehydrationScript from '../../src/internals/PrehydrationScript.vue';

defineProps<{
  /** The nonce that the part gives to `CSPProvider`. */
  nonce?: string | undefined;
}>();

const isHydrating = useIsHydrating();

// The element has the `style` key only after the mount. Before it, the script sets the style, and
// an `undefined` style gives `style=""` on a server.
const elementProps = computed(() =>
  isHydrating.value
    ? { hidden: true, 'data-allow-mismatch': 'attribute' }
    : { style: { '--prehydrated': '1' } },
);
</script>

<template>
  <CSPProvider :nonce="nonce">
    <span data-testid="element" v-bind="elementProps" />
    <PrehydrationScript :script="PREHYDRATION_SCRIPT_PART_SCRIPT" />
  </CSPProvider>
</template>
