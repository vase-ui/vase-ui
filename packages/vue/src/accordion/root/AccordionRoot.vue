<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import type { REASONS } from '../../internals/reasons';
import type { Orientation, VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export type AccordionValue<Value = any> = Value[];

export interface AccordionRootState<Value = any> {
  /**
   * The current value.
   * Treat it as read-only: it may be a shared frozen array when no value is set.
   */
  value: AccordionValue<Value>;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * The component orientation.
   *
   * Deprecated following the [APG guidance update](https://github.com/w3c/aria-practices/pull/3434)
   * to remove roving focus.
   *
   * This state no longer affects keyboard focus behavior.
   * @deprecated
   */
  orientation: Orientation;
}

export interface AccordionRootProps<Value = any>
  extends
    VaseUIComponentProps<AccordionRootState<Value>>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * The controlled value of the item(s) that should be expanded.
   * `null` is an empty value, and the accordion stays controlled.
   *
   * To render an uncontrolled accordion, use the `defaultValue` prop instead.
   */
  modelValue?: AccordionValue<Value> | null | undefined;
  /**
   * The uncontrolled value of the item(s) that should be initially expanded.
   * `null` is an empty value.
   *
   * To render a controlled accordion, use the `modelValue` prop instead.
   */
  defaultValue?: AccordionValue<Value> | null | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Allows the browser's built-in page search to find and expand the panel contents.
   *
   * Overrides the `keepMounted` prop and uses `hidden="until-found"`
   * to hide the element without removing it from the DOM.
   * @default false
   */
  hiddenUntilFound?: boolean | undefined;
  /**
   * Whether to keep the element in the DOM while the panel is closed.
   * This prop is ignored when `hiddenUntilFound` is used.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * Whether multiple items can be open at the same time.
   * @default false
   */
  multiple?: boolean | undefined;
}

export type AccordionRootChangeEventReason = typeof REASONS.triggerPress | typeof REASONS.none;

export type AccordionRootChangeEventDetails =
  VaseUIChangeEventDetails<AccordionRootChangeEventReason>;

const rootStateAttributesMapping = {
  value: () => null,
};
</script>

<script setup lang="ts" generic="Value = any">
import { computed, onMounted, provide, shallowRef, watchEffect } from 'vue';
import { EMPTY_ARRAY } from '../../common/empty';
import { useControlled } from '../../common/useControlled';
import { warn } from '../../common/warn';
import { useCompositeList } from '../../internals/composite/list/useCompositeList';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../internals/useRenderElement';
import { AccordionRootContext } from './AccordionRootContext';

defineOptions({ inheritAttrs: false });

// An absent Boolean prop is `false` in Vue. `keepMounted` stays `undefined`, because only an
// explicit `keepMounted={false}` gets the warning below.
const props = withDefaults(defineProps<AccordionRootProps<Value>>(), {
  as: 'div',
  modelValue: undefined,
  defaultValue: undefined,
  disabled: false,
  hiddenUntilFound: false,
  keepMounted: undefined,
  multiple: false,
});

const emit = defineEmits<{
  /**
   * Event handler called when an accordion item is expanded or collapsed.
   * Provides the new value as an argument.
   */
  valueChange: [value: AccordionValue<Value>, eventDetails: AccordionRootChangeEventDetails];
  /**
   * Event handler called after `valueChange` with the new value, unless a listener cancels the
   * change. `v-model` uses it.
   */
  'update:modelValue': [value: AccordionValue<Value>];
}>();

defineSlots<{
  default(props: { state: AccordionRootState<Value> }): unknown;
  render: ComponentRenderFn<HTMLProps, AccordionRootState<Value>>;
}>();

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Accordion.Root');
  onMounted(() => {
    watchEffect(() => {
      if (props.hiddenUntilFound && props.keepMounted === false) {
        warn(
          'The `keepMounted` prop of `Accordion.Root` is `false` and `hiddenUntilFound` is enabled.',
          'The panels must stay mounted while they are closed, so `keepMounted` has no effect.',
          'Remove `keepMounted`, or remove `hiddenUntilFound`.',
        );
      }
    });
  });
}

const itemList = useCompositeList({ elementsRef: shallowRef([]), provide: false });

const openValues = useControlled<AccordionValue<Value>>({
  // `undefined` makes the part uncontrolled, so only `null` becomes an empty value.
  controlled: () => (props.modelValue === null ? EMPTY_ARRAY : props.modelValue),
  default: () => props.defaultValue ?? EMPTY_ARRAY,
  name: 'Accordion',
  state: 'value',
});

function handleValueChange(
  newValue: Value,
  nextOpen: boolean,
  eventDetails: AccordionRootChangeEventDetails,
) {
  let nextValue: AccordionValue<Value>;
  if (!props.multiple) {
    nextValue = openValues.value[0] === newValue ? [] : [newValue];
  } else if (nextOpen) {
    // Not `concat`: an item value can itself be an array, which `concat` would flatten.
    nextValue = [...openValues.value, newValue];
  } else {
    nextValue = openValues.value.filter((v) => v !== newValue);
  }

  emit('valueChange', nextValue, eventDetails);
  if (eventDetails.isCanceled) {
    return;
  }
  emit('update:modelValue', nextValue);
  openValues.value = nextValue;
}

const state = computed<AccordionRootState<Value>>(() => ({
  value: openValues.value,
  disabled: props.disabled,
  orientation: 'vertical',
}));

provide(AccordionRootContext, {
  handleValueChange,
  hiddenUntilFound: computed(() => props.hiddenUntilFound),
  itemList,
  keepMounted: computed(() => props.keepMounted ?? false),
  state,
});

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  stateAttributesMapping: rootStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
