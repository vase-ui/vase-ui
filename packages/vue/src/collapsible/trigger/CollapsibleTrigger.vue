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
import { useInDisabledFieldset } from '../../fieldset/part';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { useDeferredServerRender } from '../../internals/labelable-provider';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { useButton } from '../../internals/use-button/useButton';
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

const { panelId, handleTrigger, state: disclosure } = useCollapsibleRootContext();

// The panel registers its id in `setup`, and it can come after the trigger.
useDeferredServerRender();

const fieldsetDisabled = useInDisabledFieldset(() => element.value);
const isDisabled = computed(
  () =>
    props.disabled || disclosure.value.disabled || (props.nativeButton && fieldsetDisabled.value),
);

const state = computed<CollapsibleTriggerState>(() => ({
  ...disclosure.value,
  disabled: isDisabled.value,
}));

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('button', props, {
  button: (element) =>
    useButton(element, {
      disabled: isDisabled,
      native: () => props.nativeButton,
    }),
  state,
  props: (attrs) => [
    {
      'aria-controls': disclosure.value.open ? panelId.value : undefined,
      'aria-expanded': disclosure.value.open,
      onClick: handleTrigger,
    },
    attrs,
  ],
  stateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
