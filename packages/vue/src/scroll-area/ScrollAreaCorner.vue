<script setup lang="ts">
import { mergeProps, onUnmounted, useAttrs, type HTMLAttributes } from 'vue';
import { useElement, type AsProps } from '../common/element';
import { injectScrollArea } from './root';

defineOptions({ inheritAttrs: false });

defineProps<AsProps & /* @vue-ignore */ Omit<HTMLAttributes, 'as'>>();
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
    v-if="!root.state.cornerHidden && $slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
  />
  <component
    :is="as"
    v-else-if="!root.state.cornerHidden && as"
    v-bind="elementProps()"
    :ref="setElement"
  >
    <slot />
  </component>
  <div v-else-if="!root.state.cornerHidden" v-bind="elementProps()" :ref="setElement">
    <slot />
  </div>
</template>
