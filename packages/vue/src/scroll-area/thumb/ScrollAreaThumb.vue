<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface ScrollAreaThumbState {
  /**
   * Whether the scroll area is being scrolled.
   */
  scrolling: boolean;
  /**
   * The component orientation.
   */
  orientation: 'horizontal' | 'vertical';
}

export interface ScrollAreaThumbProps
  extends
    VaseUIComponentProps<ScrollAreaThumbState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed, watch } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useScrollAreaRootContext } from '../root/ScrollAreaRootContext';
import * as ScrollAreaScrollbarCssVars from '../scrollbar/ScrollAreaScrollbarCssVars';
import { useScrollAreaScrollbarContext } from '../scrollbar/ScrollAreaScrollbarContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ScrollAreaThumbProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ScrollAreaThumbState }): unknown;
  render: ComponentRenderFn<HTMLProps, ScrollAreaThumbState>;
}>();

const {
  thumbYElement,
  thumbXElement,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  scrollingX,
  scrollingY,
  hasMeasuredScrollbar,
} = useScrollAreaRootContext();

const orientation = useScrollAreaScrollbarContext();

const state = computed<ScrollAreaThumbState>(() => ({
  scrolling: (orientation.value === 'vertical' ? scrollingY : scrollingX).value,
  orientation: orientation.value,
}));

function getElementHolder(thumbOrientation: 'vertical' | 'horizontal') {
  return thumbOrientation === 'vertical' ? thumbYElement : thumbXElement;
}

const { element, elementProps } = useRenderElement('div', props, {
  // `useRenderElement` calls this callback only when the element changes. The callback reads the
  // orientation when it runs. A change of the orientation of the scrollbar does not change the
  // element, so the `watch` below moves the element to the other holder.
  ref: (thumb) => {
    getElementHolder(orientation.value).value = thumb;
  },
  state,
  props: (attrs) => [
    {
      onPointerdown: handlePointerDown,
      onPointermove: handlePointerMove,
      onPointerup: handlePointerUp,
      onPointercancel: handlePointerUp,
      style: {
        visibility: hasMeasuredScrollbar.value ? undefined : 'hidden',
        ...(orientation.value === 'vertical'
          ? { height: `var(${ScrollAreaScrollbarCssVars.scrollAreaThumbHeight})` }
          : { width: `var(${ScrollAreaScrollbarCssVars.scrollAreaThumbWidth})` }),
      },
    },
    attrs,
  ],
});

watch(orientation, (nextOrientation, previousOrientation) => {
  const thumb = element.value;
  if (!thumb) {
    return;
  }

  const previousHolder = getElementHolder(previousOrientation);
  if (previousHolder.value === thumb) {
    previousHolder.value = null;
  }
  getElementHolder(nextOrientation).value = thumb;
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
