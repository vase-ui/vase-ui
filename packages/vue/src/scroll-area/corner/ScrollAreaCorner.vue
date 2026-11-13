<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface ScrollAreaCornerState {}

export interface ScrollAreaCornerProps
  extends
    VaseUIComponentProps<ScrollAreaCornerState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { EMPTY_OBJECT } from '../../common/empty';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useScrollAreaRootContext } from '../root/ScrollAreaRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ScrollAreaCornerProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ScrollAreaCornerState }): unknown;
  render: ComponentRenderFn<HTMLProps, ScrollAreaCornerState>;
}>();

const state: ScrollAreaCornerState = EMPTY_OBJECT;

const { cornerElement, cornerSize, hiddenState } = useScrollAreaRootContext();

// The viewport writes the corner size only while `cornerElement` has an element. A hidden corner
// has no element, so the viewport then stops its writes.
const { element, elementProps } = useRenderElement('div', props, {
  ref: (corner) => {
    cornerElement.value = corner;
  },
  props: (attrs) => [
    {
      'aria-hidden': true,
      style: {
        position: 'absolute',
        bottom: 0,
        insetInlineEnd: 0,
        width: `${cornerSize.value.width}px`,
        height: `${cornerSize.value.height}px`,
      },
    },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <template v-if="!hiddenState.corner">
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
    <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
  </template>
</template>
