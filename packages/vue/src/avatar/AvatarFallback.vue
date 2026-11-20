<script setup lang="ts">
import { computed, shallowRef, useAttrs, watchEffect } from 'vue';
import { useElement } from '../common/element';
import { useEnterAfterLeave } from '../common/useEnterAfterLeave';
import { injectAvatarRoot } from './root';
import type { AvatarFallbackProps, AvatarFallbackState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<AvatarFallbackProps>(), { delay: 0 });
defineSlots<{
  default?(scope: { state: AvatarFallbackState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: AvatarFallbackState;
  }): unknown;
}>();

const root = injectAvatarRoot('Fallback');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLSpanElement>();
const waited = shallowRef(false);
const needed = computed(() => waited.value && root.state.imageLoadingStatus !== 'loaded');
const { waiting } = useEnterAfterLeave(() => needed.value, element);
const shown = computed(() => needed.value && !waiting.value);

// A server stops the effect after its first run, and the cleanup clears the timer.
watchEffect((onCleanup) => {
  if (props.delay === 0) {
    waited.value = true;
    return;
  }
  const timer = setTimeout(() => (waited.value = true), props.delay);
  onCleanup(() => clearTimeout(timer));
});

defineExpose({ element });

function elementProps() {
  return { ...attrs };
}
</script>

<template>
  <slot
    v-if="shown && $slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="root.state"
  />
  <span v-else-if="shown" v-bind="elementProps()" :ref="setElement">
    <slot :state="root.state" />
  </span>
</template>
