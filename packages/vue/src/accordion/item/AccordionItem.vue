<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import type { REASONS } from '../../internals/reasons';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { AccordionRootState } from '../root/AccordionRoot.vue';

export interface AccordionItemState extends AccordionRootState {
  /**
   * Whether the accordion item's panel is currently hidden.
   */
  hidden: boolean;
  /**
   * The item index.
   */
  index: number;
  /**
   * Whether the component is open.
   */
  open: boolean;
}

export interface AccordionItemProps
  extends
    VaseUIComponentProps<AccordionItemState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * A unique value that identifies this accordion item.
   * If no value is provided, a unique ID will be generated automatically.
   * Use when controlling the accordion programmatically, or to set an initial
   * open state.
   * @example
   * ```vue
   * <Accordion.Root :model-value="['a']">
   *   <Accordion.Item value="a" /> <!-- initially open -->
   *   <Accordion.Item value="b" /> <!-- initially closed -->
   * </Accordion.Root>
   * ```
   */
  value?: any;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type AccordionItemChangeEventReason = typeof REASONS.triggerPress | typeof REASONS.none;

export type AccordionItemChangeEventDetails =
  VaseUIChangeEventDetails<AccordionItemChangeEventReason>;
</script>

<script setup lang="ts">
import { computed, provide, shallowRef, type ShallowRef } from 'vue';
import { useCollapsibleRoot } from '../../collapsible/root/CollapsibleRootContext';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeList';
import { createIdRegistry } from '../../internals/labelable-provider/createIdRegistry';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import {
  accordionStateAttributesMapping,
  useAccordionRootContext,
} from '../root/AccordionRootContext';
import { AccordionItemContext } from './AccordionItemContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<AccordionItemProps>(), {
  as: 'div',
  value: undefined,
  disabled: false,
});

const emit = defineEmits<{
  /**
   * Event handler called when the panel is opened or closed.
   */
  openChange: [open: boolean, eventDetails: AccordionItemChangeEventDetails];
}>();

defineSlots<{
  default(props: { state: AccordionItemState }): unknown;
  render: ComponentRenderFn<HTMLProps, AccordionItemState>;
}>();

const { handleValueChange, itemList, state: rootState } = useAccordionRootContext();

const fallbackValue = useVaseUiId();

const itemValue = computed(() => props.value ?? fallbackValue.value);

const isDisabled = computed(() => props.disabled || rootState.value.disabled);

const isOpen = computed(() => rootState.value.value.includes(itemValue.value));

function requestOpen(nextOpen: boolean, eventDetails: AccordionItemChangeEventDetails) {
  emit('openChange', nextOpen, eventDetails);

  if (eventDetails.isCanceled) {
    return;
  }

  handleValueChange(itemValue.value, nextOpen, eventDetails);
}

// The panel owns the transition attributes. The item has no enter layout to measure.
const { mounted } = useCollapsibleRoot(isOpen, isDisabled, requestOpen);

const element: ShallowRef<HTMLElement | null> = shallowRef(null);
const index = useCompositeListItem(element, { list: itemList });

const state = computed<AccordionItemState>(() => ({
  ...rootState.value,
  hidden: !isOpen.value && !mounted.value,
  index: index.value,
  disabled: isDisabled.value,
  open: isOpen.value,
}));

const defaultTriggerId = useVaseUiId();
const { ids: triggerIds, registerId: registerTriggerId } = createIdRegistry();

provide(AccordionItemContext, {
  defaultTriggerId,
  registerTriggerId,
  state,
  triggerId: computed(() => triggerIds.value.at(-1)),
});

const { elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  elementRef: element,
  state,
  stateAttributesMapping: accordionStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
