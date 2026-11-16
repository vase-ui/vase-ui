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
import { accordionStateAttributesMapping } from '../item/stateAttributesMapping';

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
import { useAriaAfterHydration } from '../../common/hydration';
import { useDeferredServerRender } from '../../internals/labelable-provider';
import { useRegisteredId } from '../../internals/labelable-provider/useRegisteredId';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { givenId } from '../../internals/useBaseUiId';
import { useButton } from '../../internals/use-button';
import { useRenderElement } from '../../internals/useRenderElement';
import { useAccordionItemContext } from '../item/AccordionItemContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<AccordionTriggerProps>(), {
  as: 'button',
  nativeButton: true,
  disabled: false,
});

defineSlots<{
  default(props: { state: AccordionTriggerState }): unknown;
  render: ComponentRenderFn<HTMLProps, AccordionTriggerState>;
}>();

const { panelId, open, handleTrigger, disabled: contextDisabled } = useCollapsibleRootContext();

// The panel registers its id in `setup`, and it can come after the trigger.
useDeferredServerRender();

const isDisabled = computed(() => props.disabled || contextDisabled.value);

const { getButtonProps, buttonRef } = useButton({
  disabled: isDisabled,
  native: () => props.nativeButton,
});

const { defaultTriggerId, registerTriggerId, state: itemState } = useAccordionItemContext();

const triggerId = computed(() => givenId(props.id) ?? defaultTriggerId.value);

const source = Symbol();

useRegisteredId(
  () => triggerId.value,
  (getId) => registerTriggerId(source, getId),
);

const state = computed<AccordionTriggerState>(() => ({
  ...itemState.value,
  disabled: isDisabled.value,
}));

const ariaAfterHydration = useAriaAfterHydration();
const { element, elementProps } = useRenderElement('button', props, {
  state,
  ref: buttonRef,
  props: (attrs) => [
    {
      'aria-controls': ariaAfterHydration(open.value ? panelId.value : undefined),
      'aria-expanded': open.value,
      id: triggerId.value,
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
