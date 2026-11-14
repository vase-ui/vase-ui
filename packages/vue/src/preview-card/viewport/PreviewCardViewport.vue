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
import { computed } from 'vue';
import type { Component } from 'vue';
import type { HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import PopupViewportChildren from '../../utils/popups/viewport/PopupViewportChildren.vue';
import {
  popupViewportStateMapping,
  usePopupViewport,
} from '../../utils/popups/viewport/usePopupViewport';
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

const store = usePreviewCardRootContext();
const positioner = usePreviewCardPositionerContext();

const { state: viewportState } = usePopupViewport({ store, side: positioner.side });

const state = computed<PreviewCardViewportState>(() => ({
  activationDirection: viewportState.value.activationDirection,
  transitioning: viewportState.value.transitioning,
  instant: store.select('instantType'),
}));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  stateAttributesMapping: popupViewportStateMapping,
  children: true,
});

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :children="PopupViewportChildren" />
  <component :is="as" v-else v-bind="elementProps()"><PopupViewportChildren><slot :state="state" /></PopupViewportChildren></component>
</template>
