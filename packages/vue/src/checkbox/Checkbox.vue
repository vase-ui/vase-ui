<script setup lang="ts">
import { computed, inject, mergeProps, nextTick, ref, useAttrs, useId, watch } from 'vue';
import { checkboxGroupKey } from '../checkbox-group/checkbox';
import { createChangeEventDetails } from '../common/changeEventDetails';
import { useElement } from '../common/element';
import { controlAttributes, fieldKey } from '../field/control';
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
const generatedId = useId();
const { element, setElement } = useElement<HTMLInputElement>();
const inDisabledFieldset = useInDisabledFieldset(element);

// The group holds the state of its parent checkbox and of a checkbox with a `value`.
const isParent = computed(() => !!group?.hasAllValues && props.parent);
const inGroup = computed(() => !!group && (isParent.value || props.value !== undefined));

const firstChecked = props.modelValue ?? props.defaultChecked;
// The state while no `modelValue` controls it: the last state, controlled or not.
const ownChecked = ref(firstChecked);
const checked = computed(() => {
  if (isParent.value) return group!.parent.checked;
  if (inGroup.value) return group!.value.includes(props.value!);
  return props.modelValue ?? ownChecked.value;
});
const indeterminate = computed(
  () => props.indeterminate || (isParent.value && group!.parent.indeterminate),
);
const disabled = computed(() => !!field?.disabled || !!group?.disabled || props.disabled);
const id = computed(() => props.id || field?.controlId || generatedId);
const state = computed<CheckboxState>(() => ({
  checked: checked.value,
  indeterminate: indeterminate.value,
  disabled: disabled.value || inDisabledFieldset.value,
  readonly: props.readonly,
  touched: field?.state.touched ?? false,
  dirty: field?.state.dirty ?? false,
  valid: field?.state.valid ?? null,
  filled: field?.state.filled ?? false,
}));

const ownProps = computed(() => ({
  type: 'checkbox',
  id: id.value,
  // A form gets no entry from the parent checkbox.
  name: isParent.value ? undefined : (field?.name ?? props.name),
  value: props.value,
  checked: checked.value,
  indeterminate: indeterminate.value,
  disabled: disabled.value,
  // HTML gives a checkbox no `readonly` attribute. CSS matches `[aria-readonly="true"]`.
  'aria-readonly': props.readonly ? 'true' : undefined,
  'aria-controls': isParent.value ? group!.parent.controls : undefined,
  // The server HTML has no `:indeterminate`.
  'data-indeterminate': indeterminate.value ? '' : undefined,
  ...(field && {
    ...controlAttributes(field),
    // `:checked` matches a filled checkbox.
    'data-filled': undefined,
  }),
  onClick,
  onChange,
  onBlur,
}));

watch(
  checked,
  (next) => {
    ownChecked.value = next;
    field?.setValue(next, next);
  },
  { immediate: true },
);

watch(
  element,
  (el, _, onCleanup) => {
    if (!el) return;
    const form = el.form;
    form?.addEventListener('reset', onReset);
    const removeControl = field?.setControl({
      element: el,
      get id() {
        return id.value;
      },
      get name() {
        return props.name;
      },
      get disabled() {
        return props.disabled || inDisabledFieldset.value;
      },
      get readOnly() {
        return props.readonly;
      },
      inputs: [el],
    });
    const removeFromGroup =
      inGroup.value && !isParent.value
        ? group!.addCheckbox({
            get value() {
              return props.value!;
            },
            get id() {
              return id.value;
            },
            element: el,
            get disabled() {
              return state.value.disabled;
            },
          })
        : undefined;
    onCleanup(() => {
      form?.removeEventListener('reset', onReset);
      removeControl?.();
      removeFromGroup?.();
    });
  },
  { flush: 'post' },
);

defineExpose({ element });

function elementProps() {
  const merged = mergeProps(ownProps.value, attrs);
  // HTML gives a checkbox no read-only state, so a required read-only checkbox would block its
  // form.
  if (props.readonly) merged.required = false;
  return merged;
}

// Vue writes `checked` only when the state changes. When the parent refuses a state, or a
// listener cancels a change, the element must show the state again. A click also clears the
// `indeterminate` of the element.
function showState() {
  if (!element.value) return;
  element.value.checked = checked.value;
  element.value.indeterminate = indeterminate.value;
}

function onClick(event: Event) {
  // The browser keeps the state and fires no `change`.
  if (props.readonly) event.preventDefault();
}

function onChange(event: Event) {
  const details = createChangeEventDetails('none', event);
  let accepted: boolean;
  if (isParent.value) {
    const next = group!.nextOfParent();
    emit('checkedChange', next.checked, details);
    accepted = !details.isCanceled && group!.change(next.value, details, false);
    if (accepted) emit('update:modelValue', next.checked);
  } else {
    const next = (event.currentTarget as HTMLInputElement).checked;
    emit('checkedChange', next, details);
    accepted = !details.isCanceled && (!inGroup.value || changeGroup(next, details));
    if (accepted) {
      ownChecked.value = next;
      emit('update:modelValue', next);
    }
  }
  if (accepted && props.indeterminate) emit('update:indeterminate', false);
  // The parent can refuse a controlled state. Its answer arrives with its next render.
  nextTick(() => {
    showState();
    if (!accepted) return;
    if (inGroup.value) group!.onEdit();
    else field?.onEdit();
  });
}

function changeGroup(next: boolean, details: CheckboxChangeEventDetails) {
  const value = props.value!;
  const others = group!.value.filter((v) => v !== value);
  return group!.change(next ? [...others, value] : others, details, true);
}

function onReset(event: Event) {
  // A form resets only the controls that it owns at that moment: an element that `KeepAlive`
  // holds has no form.
  if (element.value?.form !== event.currentTarget) return;
  // The form resets its controls to their `checked` attribute, which Vue sets to each state, so
  // the checkbox gives the first state. A later listener can still prevent the reset, so the
  // checkbox waits for the end of the event.
  setTimeout(() => {
    if (event.defaultPrevented) return;
    if (inGroup.value) return group!.onReset(event);
    field?.onReset(firstChecked);
    if (checked.value === firstChecked) return;
    ownChecked.value = firstChecked;
    emit('update:modelValue', firstChecked);
  });
}

function onBlur() {
  field?.onLeave();
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
