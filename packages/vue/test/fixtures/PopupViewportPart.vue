<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../src/internals/types';

export interface PopupViewportPartState {
  /** The direction from which the popup moved to the active trigger. */
  activationDirection: string | undefined;
  /** Whether the viewport shows the old content and the new content. */
  transitioning: boolean;
  /** Present if animations are instant. */
  instant: 'dismiss' | 'focus' | undefined;
}

export interface PopupViewportPartProps
  extends
    VaseUIComponentProps<PopupViewportPartState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed, inject } from 'vue';
import type { Component } from 'vue';
import type { HTMLProps } from '../../src/internals/types';
import { useRenderElement } from '../../src/internals/useRenderElement';
import PopupViewportChildren from '../../src/utils/popups/viewport/PopupViewportChildren.vue';
import {
  popupViewportStateMapping,
  usePopupViewport,
} from '../../src/utils/popups/viewport/usePopupViewport';
import { PopupFixtureContext, PopupFixturePositionerContext } from './PopupFixture';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopupViewportPartProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: PopupViewportPartState }): unknown;
  render(props: { props: HTMLProps; state: PopupViewportPartState; children: Component }): unknown;
}>();

const store = inject(PopupFixtureContext);
const positioner = inject(PopupFixturePositionerContext);
if (store === undefined || positioner === undefined) {
  throw new Error('Vase UI: <PopupViewportPart> must be inside <PopupPositionerPart>.');
}

const { state: viewportState } = usePopupViewport({ store, side: positioner.side });

const state = computed<PopupViewportPartState>(() => ({
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
