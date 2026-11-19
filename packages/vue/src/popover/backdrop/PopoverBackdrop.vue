<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

export interface PopoverBackdropState {
  /**
   * Whether the popover is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface PopoverBackdropProps
  extends
    VaseUIComponentProps<PopoverBackdropState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { createElementSetter } from '../../utils/popups/createElementSetter';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { usePopoverRootContext } from '../root/PopoverRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopoverBackdropProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: PopoverBackdropState }): unknown;
  render: ComponentRenderFn<HTMLProps, PopoverBackdropState>;
}>();

const { store, open, mounted, transitionStatus } = usePopoverRootContext();

const state = computed<PopoverBackdropState>(() => ({
  open: open.value,
  transitionStatus: transitionStatus.value,
}));

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  ref: createElementSetter(store.context.backdropRef, { keepWhileHeld: true }),
  stateAttributesMapping: popupTransitionStateMapping,
  props: (attrs) => [
    {
      role: 'presentation',
      hidden: mounted.value ? undefined : true,
      style: {
        'pointer-events':
          store.state.openChangeReason === REASONS.triggerHover ? 'none' : undefined,
        'user-select': 'none',
        '-webkit-user-select': 'none',
      },
    },
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
