<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface PreviewCardViewportState {
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
  instant: 'dismiss' | 'focus' | undefined;
}

export interface PreviewCardViewportProps
  extends
    VaseUIComponentProps<PreviewCardViewportState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import type { Component } from 'vue';
import type { HTMLProps } from '../../internals/types';
import PopupViewportChildren from '../../utils/popups/viewport/PopupViewportChildren.vue';
import { usePopupViewport } from '../../utils/popups/viewport/usePopupViewport';
import { usePreviewCardPositionerContext } from '../positioner/PreviewCardPositionerContext';
import { usePreviewCardRootContext } from '../root/PreviewCardContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PreviewCardViewportProps>(), { as: 'div' });

defineSlots<{
  /**
   * The content to render inside the transition container.
   */
  default(props: { state: PreviewCardViewportState }): unknown;
  render(props: {
    props: HTMLProps;
    state: PreviewCardViewportState;
    children: Component;
  }): unknown;
}>();

const { store } = usePreviewCardRootContext();
const positioner = usePreviewCardPositionerContext();

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
