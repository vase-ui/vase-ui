<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { Align, Side } from '../../internals/useAnchorPositioning';

export interface SelectArrowState {
  /**
   * Whether the select popup is currently open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side | 'none';
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the arrow cannot be centered on the anchor.
   */
  uncentered: boolean;
}

export interface SelectArrowProps
  extends
    VaseUIComponentProps<SelectArrowState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { useSelectPositionerContext } from '../positioner/SelectPositionerContext';
import { useSelectRootContext } from '../root/SelectRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectArrowProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: SelectArrowState }): unknown;
  render: ComponentRenderFn<HTMLProps, SelectArrowState>;
}>();

const store = useSelectRootContext();
const { createArrowRef, side, align, arrowUncentered, arrowStyles, alignItemWithTriggerActive } =
  useSelectPositionerContext();

const state = computed<SelectArrowState>(() => ({
  open: store.select('open'),
  side: side.value,
  align: align.value,
  uncentered: arrowUncentered.value,
}));

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  ref: createArrowRef(),
  stateAttributesMapping: popupTransitionStateMapping,
  props: (attrs) => [{ style: arrowStyles.value, 'aria-hidden': true }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot
    v-if="!alignItemWithTriggerActive && usesRenderSlot()"
    name="render"
    :props="elementProps()"
    :state="state"
  />
  <component :is="as" v-else-if="!alignItemWithTriggerActive" v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
