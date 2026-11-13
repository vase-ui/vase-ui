<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
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
   * <Accordion.Root :value="['a']">
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
import { computed, provide } from 'vue';
import { CollapsibleRootContext } from '../../collapsible/root/CollapsibleRootContext';
import { useCollapsibleRoot } from '../../collapsible/root/useCollapsibleRoot';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { useAccordionRootContext } from '../root/AccordionRootContext';
import { AccordionItemContext } from './AccordionItemContext';
import { accordionStateAttributesMapping } from './stateAttributesMapping';

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

const { ref: listItemRef, index } = useCompositeListItem();

const {
  disabled: contextDisabled,
  handleValueChange,
  state: rootState,
  value: openValues,
} = useAccordionRootContext();

const fallbackValue = useVaseUiId();

const itemValue = computed(() => props.value ?? fallbackValue.value);

const isDisabled = computed(() => props.disabled || contextDisabled.value);

const isOpen = computed(() => openValues.value.includes(itemValue.value));

function onOpenChange(nextOpen: boolean, eventDetails: AccordionItemChangeEventDetails) {
  emit('openChange', nextOpen, eventDetails);

  if (eventDetails.isCanceled) {
    return;
  }

  handleValueChange(itemValue.value, nextOpen, eventDetails);
}

// The call gives no `element`. The state of the item has no transition status, so the element of
// the item never has `data-starting-style`.
const collapsible = useCollapsibleRoot({
  open: isOpen,
  onOpenChange,
  disabled: isDisabled,
});

provide(CollapsibleRootContext, {
  ...collapsible,
  onOpenChange,
  state: computed(() => ({
    open: collapsible.open.value,
    disabled: collapsible.disabled.value,
    transitionStatus: collapsible.transitionStatus.value,
  })),
});

const state = computed<AccordionItemState>(() => ({
  ...rootState.value,
  hidden: !isOpen.value && !collapsible.mounted.value,
  index: index.value,
  disabled: isDisabled.value,
  open: isOpen.value,
}));

provide(AccordionItemContext, { defaultTriggerId: useVaseUiId(), state });

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [listItemRef],
  stateAttributesMapping: accordionStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
