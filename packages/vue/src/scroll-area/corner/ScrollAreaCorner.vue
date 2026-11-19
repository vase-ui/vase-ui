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
import { computed } from 'vue';
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

const { registerElement, cornerSize, viewportState } = useScrollAreaRootContext();
const visible = computed(() => !viewportState.value.cornerHidden);

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  props: (attrs) => [
    {
      'aria-hidden': true,
      style: {
        position: 'absolute',
        bottom: 0,
        insetInlineEnd: 0,
        width: `${cornerSize.width}px`,
        height: `${cornerSize.height}px`,
      },
    },
    attrs,
  ],
});

registerElement('cornerElement', element);

defineExpose({ element });
</script>

<template>
  <slot v-if="visible && usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else-if="visible" v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
