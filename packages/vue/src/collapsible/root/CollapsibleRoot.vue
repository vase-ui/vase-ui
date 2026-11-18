<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import type { REASONS } from '../../internals/reasons';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

export interface CollapsibleRootState {
  /**
   * Whether the collapsible panel is currently open.
   */
  open: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  transitionStatus: TransitionStatus;
}

export interface CollapsibleRootProps
  extends
    VaseUIComponentProps<CollapsibleRootState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Whether the collapsible panel is currently open.
   *
   * To render an uncontrolled collapsible, use the `defaultOpen` prop instead.
   */
  open?: boolean | undefined;
  /**
   * Whether the collapsible panel is initially open.
   *
   * To render a controlled collapsible, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type CollapsibleRootChangeEventReason = typeof REASONS.triggerPress | typeof REASONS.none;
export type CollapsibleRootChangeEventDetails =
  VaseUIChangeEventDetails<CollapsibleRootChangeEventReason>;
</script>

<script setup lang="ts">
import { computed, provide } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../internals/useRenderElement';
import { CollapsibleRootContext } from './CollapsibleRootContext';
import { collapsibleStateAttributesMapping } from './stateAttributesMapping';
import { useCollapsibleRoot } from './useCollapsibleRoot';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CollapsibleRootProps>(), {
  as: 'div',
  open: undefined,
  defaultOpen: false,
  disabled: false,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Collapsible.Root');
}

const emit = defineEmits<{
  /**
   * Event handler called when the panel is opened or closed.
   */
  openChange: [open: boolean, eventDetails: CollapsibleRootChangeEventDetails];
  /**
   * Event handler called after `openChange` with the new value, unless a listener cancels the
   * change. `v-model:open` uses it.
   */
  'update:open': [open: boolean];
}>();

defineSlots<{
  default(props: { state: CollapsibleRootState }): unknown;
  render: ComponentRenderFn<HTMLProps, CollapsibleRootState>;
}>();

// The trigger and the `beforematch` handler of the panel call this one function. Each caller
// then writes the uncontrolled state.
function onOpenChange(nextOpen: boolean, eventDetails: CollapsibleRootChangeEventDetails) {
  emit('openChange', nextOpen, eventDetails);
  if (!eventDetails.isCanceled) {
    emit('update:open', nextOpen);
  }
}

// The getter for `element` runs after `setup`, so the later declaration of `element` is in scope.
const collapsible = useCollapsibleRoot({
  open: () => props.open,
  defaultOpen: () => props.defaultOpen,
  onOpenChange,
  disabled: () => props.disabled,
  element: () => element.value,
});

const state = computed<CollapsibleRootState>(() => ({
  open: collapsible.open.value,
  disabled: collapsible.disabled.value,
  transitionStatus: collapsible.transitionStatus.value,
}));

provide(CollapsibleRootContext, {
  ...collapsible,
  onOpenChange,
  state,
});

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  stateAttributesMapping: collapsibleStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
