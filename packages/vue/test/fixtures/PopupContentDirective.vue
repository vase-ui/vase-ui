<script setup lang="ts">
import type { PropType } from 'vue';
import { focusAtMount, type PopupContentReading } from './popupContent';

// A Vapor template takes only a function directive, which runs when the template creates its
// element, so the fixture is for a virtual DOM app.
const props = defineProps({
  log: { type: Object as PropType<{ add(entry: PopupContentReading): void }>, required: true },
});
const vFocusAtMount = {
  mounted: (element: HTMLInputElement) => props.log.add(focusAtMount(element)),
};
</script>

<template>
  <input v-focus-at-mount aria-label="Field" data-testid="field" />
</template>
