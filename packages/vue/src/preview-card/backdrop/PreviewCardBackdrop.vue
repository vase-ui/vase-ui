<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

export interface PreviewCardBackdropState {
  /**
   * Whether the preview card is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface PreviewCardBackdropProps
  extends
    VaseUIComponentProps<PreviewCardBackdropState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import type { CSSProperties } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { usePreviewCardRootContext } from '../root/PreviewCardContext';

const BACKDROP_STYLE: CSSProperties = {
  pointerEvents: 'none',
  userSelect: 'none',
  '-webkit-user-select': 'none',
};

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PreviewCardBackdropProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: PreviewCardBackdropState }): unknown;
  render: ComponentRenderFn<HTMLProps, PreviewCardBackdropState>;
}>();

const store = usePreviewCardRootContext();

const state = computed<PreviewCardBackdropState>(() => ({
  open: store.select('open'),
  transitionStatus: store.select('transitionStatus'),
}));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  stateAttributesMapping: popupTransitionStateMapping,
  props: (attrs) => [
    { role: 'presentation', hidden: !store.select('mounted'), style: BACKDROP_STYLE },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
