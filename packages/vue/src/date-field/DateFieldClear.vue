<script setup lang="ts">
import { computed, useAttrs, useSlots } from 'vue';
import { useButton } from '../common/button';
import { injectDateTimeField, stateAttributes } from '../common/date-time-field/field';
import { useElement } from '../common/element';
import type { DateFieldClearProps, DateFieldClearState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<DateFieldClearProps>();
defineSlots<{
  default?(scope: { state: DateFieldClearState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: DateFieldClearState;
  }): unknown;
}>();

const attrs = useAttrs();
const field = injectDateTimeField();
const { element, setElement } = useElement<HTMLElement>();
const slots = useSlots();
const { disabled: isDisabled, mergeAttributes } = useButton({
  element,
  disabled: () =>
    props.disabled || field.state.disabled || field.state.readonly || field.state.empty,
  // A tag in `as` is known at the render. The element of a component or of the `element` slot,
  // which wins over `as`, is known after the mount.
  tag: () => (typeof props.as === 'string' && !slots.element ? props.as : undefined),
  type: 'button',
});
const state = computed<DateFieldClearState>(() => ({ ...field.state, disabled: isDisabled.value }));

defineExpose({ element });

function elementProps() {
  return mergeAttributes(
    {
      // CSS has `:disabled`.
      ...stateAttributes(field.state),
      'data-disabled': undefined,
      onClick: (event: MouseEvent) => field.clear(event),
    },
    attrs,
  );
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <button v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </button>
</template>
