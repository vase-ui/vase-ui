<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

export interface SelectBackdropState {
  /**
   * Whether the component is open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface SelectBackdropProps
  extends
    VaseUIComponentProps<SelectBackdropState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { useSelectRootContext } from '../root/SelectRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectBackdropProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: SelectBackdropState }): unknown;
  render: ComponentRenderFn<HTMLProps, SelectBackdropState>;
}>();

const store = useSelectRootContext();

const state = computed<SelectBackdropState>(() => ({
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
