<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface PopoverViewportState {
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
  instant: 'dismiss' | 'click' | 'focus' | 'trigger-change' | undefined;
}

export interface PopoverViewportProps
  extends
    VaseUIComponentProps<PopoverViewportState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import type { Component } from 'vue';
import type { HTMLProps } from '../../internals/types';
import PopupViewportChildren from '../../utils/popups/viewport/PopupViewportChildren.vue';
import { usePopupViewport } from '../../utils/popups/viewport/usePopupViewport';
import { usePopoverPositionerContext } from '../positioner/PopoverPositionerContext';
import { usePopoverRootContext } from '../root/PopoverRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopoverViewportProps>(), { as: 'div' });

defineSlots<{
  /**
   * The content to render inside the transition container.
   */
  default(props: { state: PopoverViewportState }): unknown;
  render(props: { props: HTMLProps; state: PopoverViewportState; children: Component }): unknown;
}>();

const { store } = usePopoverRootContext();
const positioner = usePopoverPositionerContext();

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
