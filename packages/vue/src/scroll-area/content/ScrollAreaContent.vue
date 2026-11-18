<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { ScrollAreaRootState } from '../root/ScrollAreaRoot.vue';

export interface ScrollAreaContentState extends ScrollAreaRootState {}

export interface ScrollAreaContentProps
  extends
    VaseUIComponentProps<ScrollAreaContentState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { useResizeObserver } from '../../common/useResizeObserver';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import {
  scrollAreaStateAttributesMapping,
  useScrollAreaRootContext,
  useScrollAreaViewportContext,
} from '../root/ScrollAreaRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ScrollAreaContentProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ScrollAreaContentState }): unknown;
  render: ComponentRenderFn<HTMLProps, ScrollAreaContentState>;
}>();

const computeThumbPosition = useScrollAreaViewportContext();
const { viewportState } = useScrollAreaRootContext();

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state: viewportState,
  stateAttributesMapping: scrollAreaStateAttributesMapping,
  props: (attrs) => [{ role: 'presentation', style: { minWidth: 'fit-content' } }, attrs],
});

useResizeObserver(element, (_entries, _observer, firstDelivery) => {
  computeThumbPosition(firstDelivery);
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="viewportState" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="viewportState" />
  </component>
</template>
