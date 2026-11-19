<script setup lang="ts" generic="Value = any">
import { computed, inject, mergeProps, useAttrs, useId, watch } from 'vue';
import { useElement } from '../common/element';
import { useFormReset } from '../common/formReset';
import { fieldKey, fieldStateAttributes } from '../field/control';
import { useInDisabledFieldset } from '../fieldset/part';
import { radioGroupKey } from '../radio-group/radio';
import type { RadioProps, RadioState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<RadioProps<Value>>();
defineSlots<{
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: RadioState;
  }): unknown;
}>();

const group = inject(radioGroupKey, null);
if (!group) {
  throw new Error(
    'Vase UI: <Radio> must be inside <RadioGroup>. A radio with no group cannot hold a choice. Put <Radio> inside <RadioGroup>.',
  );
}
// The field of the group, or the `Field.Item` around the radio.
const field = inject(fieldKey, null);
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLInputElement>();
const inDisabledFieldset = useInDisabledFieldset(element);

const checked = computed(() => group.value === props.value);
const disabled = computed(() => !!field?.disabled || group.disabled || props.disabled);
const state = computed<RadioState>(() => ({
  checked: checked.value,
  disabled: disabled.value || inDisabledFieldset.value,
  readonly: group.readonly,
  required: group.required,
  touched: field?.state.touched ?? false,
  dirty: field?.state.dirty ?? false,
  valid: field?.state.valid ?? null,
  filled: field?.state.filled ?? false,
}));

const ownProps = computed(() => {
  const tabStop = group.tabStop;
  return {
    type: 'radio',
    id: props.id || field?.controlId || generatedId,
    name: group.name,
    form: group.form,
    value: props.value,
    checked: checked.value,
    // A read-only group is not validated.
    required: group.required && !group.readonly,
    disabled: disabled.value,
    // One tab stop for the group, after the mount of its radios.
    tabindex: tabStop ? (tabStop.element === element.value ? 0 : -1) : undefined,
    // WAI-ARIA gives a radio no `aria-readonly`, and deprecates `aria-invalid` on it.
    'data-readonly': group.readonly ? '' : undefined,
    ...(field && {
      ...fieldStateAttributes(field.state),
      // `:checked` matches a filled radio.
      'data-filled': undefined,
      'aria-describedby': field.describedBy,
    }),
    onClick,
    onChange,
  };
});

watch(
  element,
  (el, _, onCleanup) => {
    if (!el) return;
    const removeFromGroup = group.addRadio({
      get value() {
        return props.value;
      },
      element: el,
      get disabled() {
        return state.value.disabled;
      },
    });
    // A `Field.Item` names the radio with its label.
    const removeControl = field?.setControl({
      element: el,
      get id() {
        return el.id;
      },
      name: undefined,
      get disabled() {
        return state.value.disabled;
      },
      readOnly: false,
      inputs: [el],
    });
    onCleanup(() => {
      removeFromGroup();
      removeControl?.();
    });
  },
  { flush: 'post' },
);

useFormReset(element, (event) => group.onReset(event));

defineExpose({ element });

function elementProps() {
  return mergeProps(ownProps.value, attrs);
}

function onClick(event: Event) {
  // The browser keeps the checked radio and fires no `change`.
  if (group!.readonly) event.preventDefault();
}

function onChange(event: Event) {
  group!.select(props.value, event);
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
