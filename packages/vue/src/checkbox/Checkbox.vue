<script setup lang="ts">
import { computed, inject, mergeProps, useAttrs, useId, watch } from 'vue';
import { checkboxGroupKey } from '../checkbox-group/checkbox';
import { useChecked, type CheckedOwner } from '../common/checked';
import { useDeferredServerRender } from '../common/deferredServerRender';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { fieldKey, useFieldControl } from '../field/control';
import { useInDisabledFieldset } from '../fieldset/part';
import type { CheckboxChangeEventDetails, CheckboxProps, CheckboxState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CheckboxProps>(), {
  // An absent `modelValue` makes the checkbox uncontrolled.
  modelValue: undefined,
});
const emit = defineEmits<{
  checkedChange: [checked: boolean, details: CheckboxChangeEventDetails];
  'update:modelValue': [checked: boolean];
  'update:indeterminate': [indeterminate: false];
}>();
defineSlots<{
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: CheckboxState;
  }): unknown;
}>();

const attrs = useAttrs();
const field = inject(fieldKey, null);
const group = inject(checkboxGroupKey, null);
// The label and the messages of the field can come after the checkbox.
useDeferredServerRender();
const generatedId = useId();
const { element, setElement } = useElement<HTMLInputElement>();
const inDisabledFieldset = useInDisabledFieldset(element);

// The group holds the state of its parent checkbox and of a checkbox with a `value`.
const isParent = computed(() => !!group?.hasAllValues && props.parent);
const inGroup = computed(() => !!group && (isParent.value || props.value !== undefined));
const owner = computed<CheckedOwner | undefined>(() => {
  if (!group || !inGroup.value) return undefined;
  const common = { onEdit: () => group.onEdit(), onReset: group.onReset };
  if (isParent.value) {
    return {
      ...common,
      get checked() {
        return group.parent.checked;
      },
      press() {
        const next = group.nextOfParent();
        return {
          checked: next.checked,
          change: (details) => group.change(next.value, details, false),
        };
      },
    };
  }
  const value = props.value;
  if (value === undefined) return undefined;
  return {
    ...common,
    get checked() {
      return group.value.includes(value);
    },
    press: (pressed) => ({
      checked: pressed,
      change(details) {
        const others = group.value.filter((v) => v !== value);
        return group.change(pressed ? [...others, value] : others, details, true);
      },
    }),
  };
});

const isIndeterminate = computed(
  () => props.indeterminate || (isParent.value && !!group?.parent.indeterminate),
);
const { checked, attributes } = useChecked({
  model: () => props.modelValue,
  defaultChecked: () => props.defaultChecked,
  readonly: () => props.readonly,
  required: () => props.required,
  // The group gives the form the values of its checked checkboxes.
  uncheckedValue: () => (inGroup.value ? undefined : props.uncheckedValue),
  element,
  field,
  owner: () => owner.value,
  emitChange: (next, details) => emit('checkedChange', next, details),
  emitModel: (next) => emit('update:modelValue', next),
  onAccepted() {
    if (props.indeterminate) emit('update:indeterminate', false);
  },
  // A click clears the `indeterminate` of the element.
  show: (el) => (el.indeterminate = isIndeterminate.value),
});
const isDisabled = computed(
  () => !!field?.disabled || !!group?.disabled || props.disabled || inDisabledFieldset.value,
);
const elementId = computed(() => givenId(props.id) ?? field?.controlId ?? generatedId);
const state = computed<CheckboxState>(() => ({
  checked: checked.value,
  indeterminate: isIndeterminate.value,
  disabled: isDisabled.value,
  readonly: props.readonly,
  required: props.required,
  touched: field?.state.touched ?? false,
  dirty: field?.state.dirty ?? false,
  valid: field?.state.valid ?? null,
  filled: field?.state.filled ?? false,
}));

const ownProps = computed(() => ({
  type: 'checkbox',
  id: elementId.value,
  // A form gets no entry from the parent checkbox.
  name: isParent.value ? undefined : (field?.name ?? props.name),
  value: props.value,
  disabled: isDisabled.value,
  'aria-controls': isParent.value ? group?.parent.controls : undefined,
  // The server HTML has no `:indeterminate`.
  'data-indeterminate': isIndeterminate.value ? '' : undefined,
  ...attributes.value,
}));

// HTML has no attribute for `indeterminate`, so the server HTML has none, and the property comes
// after the mount.
watch(
  [element, isIndeterminate],
  ([el, value]) => {
    if (el) el.indeterminate = value;
  },
  { flush: 'post', immediate: true },
);

useFieldControl(field, element, {
  id: () => elementId.value,
  name: () => props.name,
  disabled: () => props.disabled || inDisabledFieldset.value,
  readOnly: () => props.readonly,
});

watch(
  [element, () => (isParent.value ? undefined : props.value)],
  ([el, value], _, onCleanup) => {
    if (!el || !group || value === undefined) return;
    onCleanup(
      group.addCheckbox({
        value,
        get id() {
          return elementId.value;
        },
        element: el,
        get disabled() {
          return state.value.disabled;
        },
      }),
    );
  },
  { flush: 'post' },
);

defineExpose({ element });

function elementProps() {
  return mergeProps(ownProps.value, attrs);
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
  <input v-else v-bind="elementProps()" :ref="setElement" />
</template>
