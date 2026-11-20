<script setup lang="ts">
import { computed, mergeProps, onUnmounted, shallowRef, useAttrs, watch } from 'vue';
import { useElement } from '../common/element';
import { useIsHydrated } from '../common/hydration';
import { visuallyHidden } from '../common/visuallyHidden';
import { injectNavigationMenuRoot, injectPositionerIfAny } from './root';
import type { NavigationMenuViewportProps, NavigationMenuViewportState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<NavigationMenuViewportProps>();
defineSlots<{
  default?(scope: { state: NavigationMenuViewportState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: NavigationMenuViewportState;
  }): unknown;
}>();

const root = injectNavigationMenuRoot('Viewport');
// With no positioner, the viewport is in place, as in a nested menu.
const inline = !injectPositionerIfAny();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const state: NavigationMenuViewportState = {};

// In place, the contents go in a `<div>` between two sentinels, because a `<Teleport>` puts them at
// the end of its target. The `<div>` is the popup of the root, for the hover and the focus.
const contents = shallowRef<HTMLElement | null>(null);
const before = shallowRef<HTMLElement | null>(null);
const after = shallowRef<HTMLElement | null>(null);
const mounted = useIsHydrated();
// A closed nested menu adds no tab stop to the content around it.
const sentinels = computed(() => inline && mounted.value && root.popup.open);

watch(
  () => (inline ? (contents.value ?? element.value) : element.value),
  (target) => {
    root.setTarget(target);
    if (inline) root.popup.setPopup(target);
  },
  { immediate: true, flush: 'sync' },
);
if (inline) {
  watch([before, after], (pair) => root.setSentinels(pair), { immediate: true, flush: 'sync' });
}
onUnmounted(() => {
  root.setTarget(null);
  if (inline) {
    root.popup.setPopup(null);
    root.setSentinels(null);
  }
});

const setContents = (target: unknown) => (contents.value = target as HTMLElement | null);
const setBefore = (target: unknown) => (before.value = target as HTMLElement | null);
const setAfter = (target: unknown) => (after.value = target as HTMLElement | null);

function elementProps() {
  return mergeProps({}, attrs);
}

defineExpose({ element });
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <template v-if="inline">
      <span
        v-if="sentinels"
        :ref="setBefore"
        tabindex="0"
        aria-hidden="true"
        :style="visuallyHidden"
        @focus="root.onSentinelFocus('before', $event)"
      />
      <div :ref="setContents"><slot :state="state" /></div>
      <span
        v-if="sentinels"
        :ref="setAfter"
        tabindex="0"
        aria-hidden="true"
        :style="visuallyHidden"
        @focus="root.onSentinelFocus('after', $event)"
      />
    </template>
    <slot v-else :state="state" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <template v-if="inline">
      <span
        v-if="sentinels"
        :ref="setBefore"
        tabindex="0"
        aria-hidden="true"
        :style="visuallyHidden"
        @focus="root.onSentinelFocus('before', $event)"
      />
      <div :ref="setContents"><slot :state="state" /></div>
      <span
        v-if="sentinels"
        :ref="setAfter"
        tabindex="0"
        aria-hidden="true"
        :style="visuallyHidden"
        @focus="root.onSentinelFocus('after', $event)"
      />
    </template>
    <slot v-else :state="state" />
  </div>
</template>
