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
import { computed } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import {
  useScrollAreaRootContext,
  useScrollAreaScrollbarContext,
} from '../root/ScrollAreaRootContext';
import * as ScrollAreaScrollbarCssVars from '../scrollbar/ScrollAreaScrollbarCssVars';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ScrollAreaThumbProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ScrollAreaThumbState }): unknown;
  render: ComponentRenderFn<HTMLProps, ScrollAreaThumbState>;
}>();

const {
  registerElement,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  scrollingX,
  scrollingY,
  hasMeasuredScrollbar,
} = useScrollAreaRootContext();

const orientation = useScrollAreaScrollbarContext();

function handleThumbPointerDown(event: PointerEvent) {
  handlePointerDown(event, orientation.value);
}

const state = computed<ScrollAreaThumbState>(() => ({
  scrolling: (orientation.value === 'vertical' ? scrollingY : scrollingX).value,
  orientation: orientation.value,
}));

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  props: (attrs) => [
    {
      onPointerdown: handleThumbPointerDown,
      onPointermove: handlePointerMove,
      onPointerup: handlePointerUp,
      onPointercancel: handlePointerUp,
      onLostpointercapture: handlePointerUp,
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

registerElement(
  () => (orientation.value === 'vertical' ? 'thumbYElement' : 'thumbXElement'),
  element,
);

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
