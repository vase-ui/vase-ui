<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  ComponentRenderFn,
  HTMLProps,
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import type { CollapsibleRootState } from '../root/CollapsibleRoot.vue';

export interface CollapsibleTriggerState extends CollapsibleRootState {}

export interface CollapsibleTriggerProps
  extends
    NativeButtonProps,
    VaseUIComponentProps<CollapsibleTriggerState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<ButtonHTMLAttributes>, 'disabled'> {
  /**
   * Whether the trigger should ignore user interaction.
   * A disabled root also disables the trigger.
   * @default false
   */
  disabled?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useFieldsetDisabled } from '../../fieldset/root/useFieldsetDisabled';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { useDeferredServerRender } from '../../internals/labelable-provider';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { useButton } from '../../internals/use-button';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../internals/useRenderElement';
import { triggerOpenStateMapping } from '../../utils/collapsibleOpenStateMapping';
import { useCollapsibleRootContext } from '../root/CollapsibleRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CollapsibleTriggerProps>(), {
  as: 'button',
  nativeButton: true,
  disabled: false,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Collapsible.Trigger');
}

defineSlots<{
  default(props: { state: CollapsibleTriggerState }): unknown;
  render: ComponentRenderFn<HTMLProps, CollapsibleTriggerState>;
}>();

const stateAttributesMapping: StateAttributesMapping<CollapsibleRootState> = {
  ...triggerOpenStateMapping,
  ...transitionStatusMapping,
};

const {
  panelId,
  open,
  handleTrigger,
  state: rootState,
  disabled: contextDisabled,
} = useCollapsibleRootContext();

// The panel registers its id in `setup`, and it can come after the trigger.
useDeferredServerRender();

const fieldsetDisabled = useFieldsetDisabled(() => element.value);
const isDisabled = computed(
  () => props.disabled || contextDisabled.value || (props.nativeButton && fieldsetDisabled.value),
);

const state = computed<CollapsibleTriggerState>(() => ({
  ...rootState.value,
  disabled: isDisabled.value,
}));

const { getButtonProps, buttonRef } = useButton({
  disabled: isDisabled,
  native: () => props.nativeButton,
});

const { element, elementProps } = useRenderElement('button', props, {
  state,
  ref: buttonRef,
  props: (attrs) => [
    {
      'aria-controls': open.value ? panelId.value : undefined,
      'aria-expanded': open.value,
      onClick: handleTrigger,
    },
    attrs,
    getButtonProps,
  ],
  stateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
