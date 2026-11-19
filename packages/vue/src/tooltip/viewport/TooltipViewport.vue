<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface TooltipViewportState {
  /**
   * The activation direction of the transitioned content.
   */
  activationDirection: string | undefined;
  /**
   * Whether the viewport is currently transitioning between contents.
   */
  transitioning: boolean;
  /**
   * Present if animations should be instant.
   */
  instant: 'delay' | 'dismiss' | 'focus' | undefined;
}

export interface TooltipViewportProps
  extends
    VaseUIComponentProps<TooltipViewportState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import type { Component } from 'vue';
import type { HTMLProps } from '../../internals/types';
import PopupViewportChildren from '../../utils/popups/viewport/PopupViewportChildren.vue';
import { usePopupViewport } from '../../utils/popups/viewport/usePopupViewport';
import { useTooltipPositionerContext, useTooltipRootContext } from '../root/TooltipRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TooltipViewportProps>(), { as: 'div' });

defineSlots<{
  /**
   * The content to render inside the transition container.
   */
  default(props: { state: TooltipViewportState }): unknown;
  render(props: { props: HTMLProps; state: TooltipViewportState; children: Component }): unknown;
}>();

const { store } = useTooltipRootContext();
const positioner = useTooltipPositionerContext();

const { element, elementProps, setRef, usesRenderSlot, state } = usePopupViewport(
  props,
  store,
  positioner.side,
);

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" :children="PopupViewportChildren" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <PopupViewportChildren><slot :state="state" /></PopupViewportChildren>
  </component>
</template>
