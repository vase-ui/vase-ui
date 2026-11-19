<script setup lang="ts" generic="Value = any">
import { computed, inject, mergeProps, useAttrs, useId, watch } from 'vue';
import { useDeferredServerRender } from '../common/deferredServerRender';
import { useElement } from '../common/element';
import { useFormReset } from '../common/formEvents';
import { givenId } from '../common/id';
import { fieldKey, fieldStateAttributes, useFieldControl } from '../field/control';
import { useInDisabledFieldset } from '../fieldset/part';
import { radioGroupKey } from '../radio-group/radio';
import type { RadioProps, RadioState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<RadioProps<Value>>();
const slots = defineSlots<{
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: RadioState;
  }): unknown;
}>();

const group = injectGroup();
// The field of the group, or the `Field.Item` around the radio.
const field = inject(fieldKey, null);
// The label and the messages of the field can come after the radio.
useDeferredServerRender();
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLInputElement>();
const inDisabledFieldset = useInDisabledFieldset(element);

const elementId = computed(() => givenId(props.id) ?? field?.controlId ?? generatedId);
const checked = computed(() => group.value === props.value);
const isDisabled = computed(
  () => !!field?.disabled || group.disabled || props.disabled || inDisabledFieldset.value,
);
const isReadonly = computed(() => group.readonly || props.readonly);
const state = computed<RadioState>(() => ({
  checked: checked.value,
  disabled: isDisabled.value,
  readonly: isReadonly.value,
  required: group.required || props.required,
  touched: field?.state.touched ?? false,
  dirty: field?.state.dirty ?? false,
  valid: field?.state.valid ?? null,
  filled: field?.state.filled ?? false,
}));

const ownProps = computed(() => {
  const tabStop = group.tabStop;
  return {
    type: 'radio',
    id: elementId.value,
    // WebKit gives no other radio of a named group the focus from the Tab key while the checked
    // radio of the group is disabled. A disabled radio gives its form no entry.
    name: isDisabled.value && checked.value ? undefined : group.name,
    form: group.form,
    value: props.value,
    checked: checked.value,
    // A read-only radio is not validated. HTML counts a disabled checked radio in its group, so
    // no radio of the group misses a value, also when that radio has no `name`.
    required: state.value.required && !isReadonly.value && !group.checkedRadioDisabled,
    disabled: isDisabled.value,
    // One tab stop for the group, after the mount of its radios. Before the mount, the browser
    // gives the tab stop to the checked radio of a named group.
    tabindex: tabStop && tabStop.element !== element.value ? -1 : undefined,
    // WAI-ARIA gives a radio no `aria-readonly`, and deprecates `aria-invalid` on it.
    'data-readonly': isReadonly.value ? '' : undefined,
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
    onCleanup(
      group.addRadio({
        get value() {
          return props.value;
        },
        element: el,
        get disabled() {
          return isDisabled.value;
        },
        get required() {
          return props.required;
        },
      }),
    );
  },
  { flush: 'post' },
);

// A `Field.Item` names the radio with its label.
useFieldControl(field, element, {
  // The `element` slot can give the element another `id`.
  id: () => (slots.element && element.value?.id) || elementId.value,
  name: () => undefined,
  disabled: () => isDisabled.value,
  readOnly: () => isReadonly.value,
});

useFormReset(element, (event) => group.onReset(event));

defineExpose({ element });

function elementProps() {
  return mergeProps(ownProps.value, attrs);
}

function injectGroup() {
  const group = inject(radioGroupKey, null);
  if (!group) {
    throw new Error(
      'Vase UI: <Radio> must be inside <RadioGroup>. A radio with no group cannot hold a choice. Put <Radio> inside <RadioGroup>.',
    );
  }
  return group;
}

function onClick(event: MouseEvent) {
  group.onClick(event, isReadonly.value);
}

function onChange(event: Event) {
  group.select(props.value, event);
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
