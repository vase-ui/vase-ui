<script setup lang="ts" generic="Value = any">
import { computed, mergeProps, nextTick, provide, shallowReactive, useAttrs, watch } from 'vue';
import { createChangeEventDetails } from '../common/changeEventDetails';
import { useDeferredServerRender } from '../common/deferredServerRender';
import { byDocumentOrder, useElement } from '../common/element';
import { useModel } from '../common/model';
import { fieldStateAttributes } from '../field/control';
import { useFieldGroup } from '../field/group';
import { useInDisabledFieldset } from '../fieldset/part';
import { radioGroupKey, type GroupRadio } from './radio';
import type { RadioGroupChangeEventDetails, RadioGroupProps, RadioGroupState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<RadioGroupProps<Value>>(), {
  modelValue: undefined,
  defaultValue: undefined,
});
const emit = defineEmits<{
  valueChange: [value: Value, details: RadioGroupChangeEventDetails];
  'update:modelValue': [value: Value | undefined];
}>();
defineSlots<{
  default?(scope: { state: RadioGroupState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: RadioGroupState;
  }): unknown;
}>();

const attrs = useAttrs();
// The label and the messages of the field can come after the group.
useDeferredServerRender();
const { element, setElement } = useElement<HTMLDivElement>();
const inDisabledFieldset = useInDisabledFieldset(element);

const firstValue = props.modelValue !== undefined ? props.modelValue : props.defaultValue;
const { value, setOwn } = useModel<Value | undefined>(() => props.modelValue, firstValue);
const radios = shallowReactive<GroupRadio[]>([]);
// The last reset that the group followed. Each radio of the group tells the group a reset.
let lastReset: Event | undefined;
// The radio that had the focus at a key press of an arrow with Ctrl, Alt or Meta, until the next
// task.
let modifiedArrowFrom: HTMLInputElement | undefined;

const tabStop = computed(() => {
  const enabled = radios.filter((radio) => !radio.disabled);
  enabled.sort((a, b) => byDocumentOrder(a.element, b.element));
  return enabled.find((radio) => radio.value === value.value) ?? enabled[0];
});
const { field, labelledBy, onFocusout } = useFieldGroup({
  element,
  disabled: () => disabled.value,
  ownDisabled: () => props.disabled || inDisabledFieldset.value,
  readOnly: () => props.readonly,
  name: () => props.name,
  inputs: () => radios.map((radio) => radio.element),
  // The focus goes to the tab stop, as the Tab key gives it.
  focusElement: () => tabStop.value?.element,
  // A form gets the value of the checked radio that is mounted and enabled.
  formValue: () =>
    radios.some((radio) => radio.value === value.value && !radio.disabled) ? value.value : null,
});
const disabled = computed<boolean>(
  () => props.disabled || !!field?.disabled || inDisabledFieldset.value,
);
const state = computed<RadioGroupState>(() => ({
  disabled: disabled.value,
  readonly: props.readonly,
  required: props.required,
  touched: field?.state.touched ?? false,
  dirty: field?.state.dirty ?? false,
  valid: field?.state.valid ?? null,
  filled: field?.state.filled ?? false,
}));

watch(value, (next) => field?.setValue(next, next != null), { immediate: true });

provide(radioGroupKey, {
  get value() {
    return value.value;
  },
  get name() {
    return field?.name ?? props.name;
  },
  get form() {
    return props.form;
  },
  get disabled() {
    return disabled.value;
  },
  get readonly() {
    return props.readonly;
  },
  get required() {
    return props.required;
  },
  get tabStop() {
    return tabStop.value;
  },
  select: (next, event) => select(next as Value, event),
  onClick,
  onReset,
  addRadio(radio) {
    radios.push(radio);
    return () => radios.splice(radios.indexOf(radio), 1);
  },
});

defineExpose({ element });

function elementProps() {
  const on = (value: boolean) => (value ? 'true' : undefined);
  return mergeProps(
    {
      role: 'radiogroup',
      'aria-labelledby': labelledBy(attrs),
      'aria-describedby': field?.describedBy,
      // WAI-ARIA gives these states to a radio group, and CSS matches them.
      'aria-disabled': on(disabled.value),
      'aria-readonly': on(props.readonly),
      // A radio with `required` makes its group required.
      'aria-required': on(props.required || radios.some((radio) => radio.required)),
      'aria-invalid': on(state.value.valid === false),
      ...fieldStateAttributes(state.value),
      'data-invalid': undefined,
      onKeydown,
      onFocusout,
    },
    attrs,
  );
}

function onClick(event: MouseEvent, readonly: boolean) {
  // The browser keeps the checked radio and fires no `change`.
  if (readonly) {
    event.preventDefault();
    return;
  }
  // WebKit selects the next radio with a click at an arrow key with Ctrl, Alt or Meta, and
  // Chromium and Firefox do nothing. The focus goes back after the move of WebKit.
  const from = modifiedArrowFrom;
  if (!from) return;
  event.preventDefault();
  setTimeout(() => from.focus());
}

function select(next: Value, event: Event) {
  const details = createChangeEventDetails('none', event);
  emit('valueChange', next, details);
  if (!details.isCanceled) {
    setOwn(next);
    emit('update:modelValue', next);
  }
  // The parent can refuse a controlled value. Its answer arrives with its next render.
  nextTick(() => {
    showValue();
    if (!details.isCanceled) field?.onEdit();
  });
}

// Vue writes `checked` only when it changes. After a refused or cancelled change, each radio must
// show the value again.
function showValue() {
  for (const radio of radios) radio.element.checked = radio.value === value.value;
}

function onReset(event: Event) {
  if (event === lastReset) return;
  lastReset = event;
  field?.onReset(firstValue);
  if (value.value === firstValue) return;
  setOwn(firstValue);
  emit('update:modelValue', firstValue);
}

const steps: Record<string, 'next' | 'previous' | 'right' | 'left'> = {
  ArrowDown: 'next',
  ArrowUp: 'previous',
  ArrowRight: 'right',
  ArrowLeft: 'left',
};

// Browsers move the focus between native radios by their own rules: WebKit does not loop and
// does not follow the text direction, and radios with no name are no group in any browser.
function onKeydown(event: KeyboardEvent) {
  const step = steps[event.key];
  const current = radios.find((radio) => radio.element === event.target);
  if (!step || !current) return;
  // With Ctrl, Alt or Meta, the browser keeps its own shortcut.
  if (event.ctrlKey || event.altKey || event.metaKey) {
    modifiedArrowFrom = current.element;
    setTimeout(() => (modifiedArrowFrom = undefined));
    return;
  }
  event.preventDefault();
  const rtl = getComputedStyle(current.element).direction === 'rtl';
  const forward = step === 'next' || step === (rtl ? 'left' : 'right');
  const choices = radios.filter((radio) => radio === current || !radio.disabled);
  choices.sort((a, b) => byDocumentOrder(a.element, b.element));
  const index = choices.indexOf(current) + (forward ? 1 : -1);
  const next = choices[(index + choices.length) % choices.length]!;
  next.element.focus();
  // A click selects the radio as the browser does, and a read-only group prevents it.
  next.element.click();
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
