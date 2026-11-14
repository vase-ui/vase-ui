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
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { usePopoverRootContext } from '../root/PopoverRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopoverBackdropProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: PopoverBackdropState }): unknown;
  render: ComponentRenderFn<HTMLProps, PopoverBackdropState>;
}>();

const store = usePopoverRootContext();

const state = computed<PopoverBackdropState>(() => ({
  open: store.select('open'),
  transitionStatus: store.select('transitionStatus'),
}));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  stateAttributesMapping: popupTransitionStateMapping,
  props: (attrs) => [
    {
      role: 'presentation',
      hidden: store.select('mounted') ? undefined : true,
      style: {
        'pointer-events':
          store.select('openChangeReason') === REASONS.triggerHover ? 'none' : undefined,
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
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
