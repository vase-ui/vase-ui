<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import { triggerOpenStateMapping } from '../../utils/collapsibleOpenStateMapping';
import type { AccordionItemState } from '../item/AccordionItem.vue';
import { accordionStateAttributesMapping } from '../root/AccordionRootContext';

export interface AccordionTriggerState extends AccordionItemState {}

export interface AccordionTriggerProps
  extends
    NativeButtonProps,
    VaseUIComponentProps<AccordionTriggerState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<ButtonHTMLAttributes>, 'disabled' | 'id'> {
  /**
   * Whether the trigger should ignore user interaction.
   * A disabled item or a disabled root also disables the trigger.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * The id of the trigger. The panel uses it for `aria-labelledby`.
   * If the id is absent or empty, the trigger has the id that the item generates.
   */
  id?: string | undefined;
}

const stateAttributesMapping: StateAttributesMapping<AccordionItemState> = {
  ...accordionStateAttributesMapping,
  ...triggerOpenStateMapping,
};
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useCollapsibleRootContext } from '../../collapsible/root/CollapsibleRootContext';
import { useFieldsetDisabled } from '../../fieldset/root/useFieldsetDisabled';
import { given } from '../../internals/givenAttributes';
import { useDeferredServerRender } from '../../internals/labelable-provider';
import { useRegisteredId } from '../../internals/labelable-provider/useRegisteredId';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button/useButton';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../internals/useRenderElement';
import { useAccordionItemContext } from '../item/AccordionItemContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<AccordionTriggerProps>(), {
  as: 'button',
  nativeButton: true,
  disabled: false,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Accordion.Trigger');
}

defineSlots<{
  default(props: { state: AccordionTriggerState }): unknown;
  render: ComponentRenderFn<HTMLProps, AccordionTriggerState>;
}>();

const { panelId, handleTrigger, state: disclosure } = useCollapsibleRootContext();

// The panel registers its id in `setup`, and it can come after the trigger.
useDeferredServerRender();

const fieldsetDisabled = useFieldsetDisabled(() => element.value);
const isDisabled = computed(
  () =>
    props.disabled || disclosure.value.disabled || (props.nativeButton && fieldsetDisabled.value),
);

const { defaultTriggerId, registerTriggerId, state: itemState } = useAccordionItemContext();

const triggerId = computed(() => given('id', props.id) ?? defaultTriggerId.value);

useRegisteredId(
  () => triggerId.value,
  registerTriggerId,
  () => element.value,
);

const state = computed<AccordionTriggerState>(() => ({
  ...itemState.value,
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
      id: triggerId.value,
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
