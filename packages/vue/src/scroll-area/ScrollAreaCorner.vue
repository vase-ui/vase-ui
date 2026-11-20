<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs, type HTMLAttributes } from 'vue';
import { useElement } from '../common/element';
import { useEnterAfterLeave } from '../common/useEnterAfterLeave';
import { injectScrollArea } from './root';

defineOptions({ inheritAttrs: false });

defineProps</* @vue-ignore */ HTMLAttributes>();
defineSlots<{
  default?(): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
  }): unknown;
}>();

const root = injectScrollArea('Corner');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

const { waiting } = useEnterAfterLeave(() => !root.state.cornerHidden, element);
const shown = computed(() => !root.state.cornerHidden && !waiting.value);

const remove = root.addCorner();
onUnmounted(remove);

defineExpose({ element });

function elementProps() {
  return mergeProps(
    {
      'aria-hidden': 'true',
      style: {
        position: 'absolute',
        bottom: 0,
        insetInlineEnd: 0,
        width: 'var(--scroll-area-corner-width)',
        height: 'var(--scroll-area-corner-height)',
      },
    },
    attrs,
  );
}
</script>

<template>
  <slot
    v-if="shown && $slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
  />
  <div v-else-if="shown" v-bind="elementProps()" :ref="setElement">
    <slot />
  </div>
</template>
