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
import { createElementSetter } from '../../utils/popups/createElementSetter';
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

const { store, open, mounted, transitionStatus } = usePreviewCardRootContext();

const state = computed<PreviewCardBackdropState>(() => ({
  open: open.value,
  transitionStatus: transitionStatus.value,
}));

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  ref: createElementSetter(store.context.backdropRef, { keepWhileHeld: true }),
  stateAttributesMapping: popupTransitionStateMapping,
  props: (attrs) => [
    { role: 'presentation', hidden: !mounted.value, style: BACKDROP_STYLE },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
