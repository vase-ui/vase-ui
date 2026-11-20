<script setup lang="ts" generic="Value = unknown">
import { computed, mergeProps, provide, useAttrs } from 'vue';
import { createChangeEventDetails } from '../common/changeEventDetails';
import { useElement } from '../common/element';
import { useModel } from '../common/model';
import { useGroupItems } from './filter';
import { useGroupLabel } from './group';
import { radioGroupKey } from './radio';
import type {
  MenuRadioGroupChangeEventDetails,
  MenuRadioGroupProps,
  MenuRadioGroupState,
} from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuRadioGroupProps<Value>>(), {
  modelValue: undefined,
  defaultValue: undefined,
  disabled: false,
});
const emit = defineEmits<{
  /** The user checks an item. `details.cancel()` keeps the value as it was. */
  valueChange: [value: Value, details: MenuRadioGroupChangeEventDetails];
  /** Comes after `valueChange`, unless a listener cancels the change. `v-model` uses it. */
  'update:modelValue': [value: Value];
}>();
defineSlots<{
  default?(scope: { state: MenuRadioGroupState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: MenuRadioGroupState;
  }): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const model = useModel(() => props.modelValue, props.defaultValue);
const labelId = useGroupLabel();
const shown = useGroupItems();
const state = computed<MenuRadioGroupState>(() => ({ disabled: props.disabled }));

provide(radioGroupKey, {
  get value() {
    return model.value.value;
  },
  get disabled() {
    return props.disabled;
  },
  select(value, event) {
    // A press of the checked item changes nothing.
    if (Object.is(value, model.value.value)) return;
    const details = createChangeEventDetails('item-press' as const, event);
    emit('valueChange', value as Value, details);
    if (details.isCanceled) return;
    model.setOwn(value as Value);
    emit('update:modelValue', value as Value);
  },
});

function elementProps() {
  return mergeProps(
    {
      role: 'group',
      'aria-labelledby': labelId.value,
      'aria-disabled': props.disabled ? 'true' : undefined,
      hidden: shown.value ? undefined : true,
    },
    attrs,
  );
}

defineExpose({ element });
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
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
