<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIChangeEventDetails } from '../../src/internals/createBaseUIEventDetails';
import { REASONS } from '../../src/internals/reasons';
import type {
  ComponentRenderFn,
  HTMLProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../src/internals/types';

export interface GenericPartState {
  /** Whether the value of the part is its option. */
  selected: boolean;
}

export type GenericPartChangeEventReason = typeof REASONS.itemPress;
export type GenericPartChangeEventDetails = VaseUIChangeEventDetails<GenericPartChangeEventReason>;

export interface GenericPartProps<Value>
  extends
    VaseUIComponentProps<GenericPartState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /** The value when the part is controlled. */
  value?: Value | undefined;
  /** The value when the part is uncontrolled. */
  defaultValue?: Value | undefined;
  /** The value that a click gives to the part. */
  option: Value;
}
</script>

<script setup lang="ts" generic="Value">
import { computed } from 'vue';
import { useControlled } from '../../src/common/useControlled';
import { createChangeEventDetails } from '../../src/internals/createBaseUIEventDetails';
import { useRenderElement } from '../../src/internals/useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<GenericPartProps<Value>>(), {
  as: 'div',
  value: undefined,
  defaultValue: undefined,
});

const emit = defineEmits<{
  valueChange: [value: Value, details: GenericPartChangeEventDetails];
  'update:value': [value: Value];
}>();

defineSlots<{
  default(props: { state: GenericPartState }): unknown;
  render: ComponentRenderFn<HTMLProps, GenericPartState>;
}>();

const [value, setValue] = useControlled({
  controlled: () => props.value,
  default: () => props.defaultValue,
  name: 'GenericPart',
  state: 'value',
});

const state = computed<GenericPartState>(() => ({ selected: value.value === props.option }));

function handleClick(event: MouseEvent) {
  const details = createChangeEventDetails(REASONS.itemPress, event);
  emit('valueChange', props.option, details);
  if (details.isCanceled) {
    return;
  }
  emit('update:value', props.option);
  setValue(props.option);
}

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [{ onClick: handleClick }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
