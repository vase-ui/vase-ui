<script setup lang="ts">
import {
  computed,
  inject,
  mergeProps,
  provide,
  shallowReactive,
  shallowRef,
  useAttrs,
  useId,
} from 'vue';
import { useElement } from '../common/element';
import { useInDisabledFieldset } from '../fieldset/part';
import { fieldKey, fieldStateAttributes, type FieldControl } from './control';
import { fieldPartsKey, injectFieldRoot, joinIds, type FieldLabel } from './root';
import type { FieldItemProps, FieldItemState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<FieldItemProps>();
defineSlots<{
  default?(scope: { state: FieldItemState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: FieldItemState;
  }): unknown;
}>();

const parts = injectFieldRoot('Item');
// The field, or the group that is the control of the field.
const field = inject(fieldKey, null);
const attrs = useAttrs();
const controlId = useId();
const { element, setElement } = useElement<HTMLDivElement>();
const inDisabledFieldset = useInDisabledFieldset(element);
const control = shallowRef<FieldControl>();
const describers = shallowReactive<{ readonly id: string; readonly shown: boolean }[]>([]);
const labels = shallowReactive<FieldLabel[]>([]);

const disabled = computed(() => props.disabled || !!field?.disabled || inDisabledFieldset.value);
const state = computed<FieldItemState>(() => ({ ...parts.state, disabled: disabled.value }));

// The control in the item has the label, the id and the descriptions of the item.
provide(fieldKey, {
  get disabled() {
    return disabled.value;
  },
  get name() {
    return field?.name;
  },
  controlId,
  labelId: undefined,
  get labelledBy() {
    return joinIds(labels.filter((label) => !label.native));
  },
  get describedBy() {
    return [field?.describedBy, joinIds(describers)].filter(Boolean).join(' ') || undefined;
  },
  get state() {
    return state.value;
  },
  setControl(added) {
    control.value = added;
    return () => (control.value = undefined);
  },
  setValue: (value, filled) => field?.setValue(value, filled),
  onEdit: () => field?.onEdit(),
  onLeave: (left) => field?.onLeave(left),
  onReset: (value) => field?.onReset(value),
});

provide(fieldPartsKey, {
  get state() {
    return state.value;
  },
  get controlId() {
    return control.value?.id ?? controlId;
  },
  get validity() {
    return parts.validity;
  },
  get errors() {
    return parts.errors;
  },
  get formErrors() {
    return parts.formErrors;
  },
  addDescriber(describer) {
    describers.push(describer);
    return () => describers.splice(describers.indexOf(describer), 1);
  },
  addLabel(label) {
    labels.push(label);
    return () => labels.splice(labels.indexOf(label), 1);
  },
  focusControl() {
    control.value?.element.focus();
  },
});

defineExpose({ element });

function elementProps() {
  return mergeProps(fieldStateAttributes(state.value, disabled.value), attrs);
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
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
