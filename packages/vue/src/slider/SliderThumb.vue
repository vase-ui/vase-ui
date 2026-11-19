<script setup lang="ts">
import {
  computed,
  inject,
  mergeProps,
  onUnmounted,
  useAttrs,
  useId,
  type CSSProperties,
} from 'vue';
import { useElement } from '../common/element';
import { useFormReset } from '../common/formEvents';
import { givenId } from '../common/id';
import { visuallyHiddenInput } from '../common/visuallyHidden';
import { controlAria, fieldKey } from '../field/control';
import { injectSlider, stateAttributes, type SliderThumbEntry } from './root';
import type { SliderThumbProps, SliderThumbState } from './types';
import { percent, snap } from './values';

defineOptions({ inheritAttrs: false });

const props = defineProps<SliderThumbProps>();
const slots = defineSlots<{
  default?(scope: { state: SliderThumbState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: SliderThumbState;
    inputProps: Record<string, unknown>;
    inputRef: (target: unknown) => void;
  }): unknown;
}>();

// The attributes and the listeners of the developer that go to the input.
const INPUT_ATTRIBUTE =
  /^(?:aria-|tabindex$|autofocus$|on(?:Focus|Blur|Keydown)(?:Capture|Once|Passive)*$)/i;
// `Toolbar.Root` moves the focus at these keys when they bubble from an item in it.
const TOOLBAR_KEYS = new Set(['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'Home', 'End']);
const KEYS = new Set([...TOOLBAR_KEYS, 'PageUp', 'PageDown']);

const slider = injectSlider('Thumb');
const field = inject(fieldKey, null);
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const { element: input, setElement: setInput } = useElement<HTMLInputElement>();
// A key with Ctrl, Alt or Meta, until the next task.
let modifiedKey = false;

const entry: SliderThumbEntry = {
  get index() {
    return props.index;
  },
  get element() {
    return element.value;
  },
  get input() {
    return input.value;
  },
  get id() {
    // The `element` slot can give the input another `id`.
    return (slots.element && input.value?.id) || inputId.value;
  },
  get disabled() {
    return isDisabled.value;
  },
};
// Nuxt removes the call of `onUnmounted` from its server build, with its arguments, so the
// part registers before the call.
const unregister = slider.addThumb(entry);
onUnmounted(unregister);

const valueIndex = computed(() => slider.thumbs.indexOf(entry));
const value = computed(() => slider.state.values[valueIndex.value]);
const isDisabled = computed(() => props.disabled || slider.state.disabled);
const inputId = computed(
  () =>
    givenId(props.id) ?? (slider.thumbs.find(Boolean) === entry ? slider.controlId : generatedId),
);
const state = computed<SliderThumbState>(() => ({ ...slider.state, disabled: isDisabled.value }));

const style = computed<CSSProperties>(() => {
  const { values, activeThumbIndex, orientation } = slider.state;
  const active = activeThumbIndex !== -1 && activeThumbIndex === valueIndex.value;
  const zIndex =
    values.length > 1
      ? active
        ? 2
        : slider.lastActive === entry
          ? 1
          : undefined
      : active
        ? 1
        : undefined;
  if (value.value === undefined) return { position: 'absolute', zIndex };
  // A percent of `translate` is of the size of the thumb, so an `edge` thumb stays in the track.
  const at = `${percent(value.value, slider.state)}%`;
  if (orientation === 'vertical') {
    return {
      position: 'absolute',
      bottom: at,
      left: '50%',
      translate: `-50% ${slider.edge ? at : '50%'}`,
      zIndex,
    };
  }
  const x = slider.edge ? (slider.rtl ? at : `-${at}`) : slider.rtl ? '50%' : '-50%';
  return { position: 'absolute', insetInlineStart: at, top: '50%', translate: `${x} -50%`, zIndex };
});

const inputStyle = computed<CSSProperties>(() => ({
  ...visuallyHiddenInput,
  // The input has the place and the size of the thumb.
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  margin: 0,
  writingMode: slider.state.orientation === 'vertical' ? 'vertical-lr' : undefined,
}));

useFormReset(input, (event) => slider.onReset(event));

defineExpose({ element, input });

function splitAttrs() {
  const ofElement: Record<string, unknown> = {};
  const ofInput: Record<string, unknown> = {};
  for (const [key, given] of Object.entries(attrs)) {
    (INPUT_ATTRIBUTE.test(key) ? ofInput : ofElement)[key] = given;
  }
  return { ofElement, ofInput };
}

function elementProps() {
  return mergeProps(
    { ...stateAttributes(state.value), style: style.value },
    splitAttrs().ofElement,
  );
}

function inputProps() {
  const { ofInput } = splitAttrs();
  const named = 'aria-label' in ofInput || 'aria-labelledby' in ofInput;
  return mergeProps(
    {
      type: 'range',
      id: inputId.value,
      name: slider.name,
      form: slider.form,
      min: slider.state.min,
      max: slider.state.max,
      step: slider.state.step,
      disabled: isDisabled.value,
      'aria-orientation': slider.state.orientation,
      'aria-valuetext': valueText(),
      ...(field && controlAria(field)),
      'aria-labelledby': named ? undefined : slider.labelId,
      style: inputStyle.value,
      onFocus,
      onBlur,
      onKeydown,
      onInput,
      value: value.value,
    },
    ofInput,
  );
}

function valueText() {
  if (value.value === undefined) return undefined;
  const text = slider.text(value.value);
  if (props.getAriaValueText) return props.getAriaValueText(text, value.value, valueIndex.value);
  return slider.hasFormat ? text : undefined;
}

function onFocus() {
  slider.onFocus(entry);
}

function onBlur(event: FocusEvent) {
  slider.onBlur(event);
}

function onInput(event: Event) {
  const target = event.currentTarget as HTMLInputElement;
  if (modifiedKey) {
    target.value = String(value.value);
    return;
  }
  slider.moveTo(valueIndex.value, target.valueAsNumber, 'input-change', event);
}

function onKeydown(event: KeyboardEvent) {
  if (!KEYS.has(event.key)) return;
  if (event.ctrlKey || event.altKey || event.metaKey) {
    // The shortcut of the browser stays. Chromium and WebKit also change a range input at an arrow
    // key with Ctrl, Alt or Meta, and Firefox does not, so the thumb refuses that change.
    modifiedKey = true;
    setTimeout(() => (modifiedKey = false));
    return;
  }
  event.preventDefault();
  if (TOOLBAR_KEYS.has(event.key)) event.stopPropagation();
  const current = value.value;
  if (current === undefined) return;
  const grid = slider.state;
  let target: number;
  if (event.key === 'Home') target = grid.min;
  else if (event.key === 'End') target = grid.max;
  else {
    const rtl = slider.readDirection(event.currentTarget as Element);
    const up =
      event.key === 'ArrowUp' ||
      event.key === 'PageUp' ||
      event.key === (rtl ? 'ArrowLeft' : 'ArrowRight');
    const large = event.shiftKey || event.key === 'PageUp' || event.key === 'PageDown';
    // A large step off the grid goes on to the next value of the grid, so the thumb moves.
    const direction = up ? 1 : -1;
    target = snap(current + direction * (large ? slider.largeStep : grid.step), grid, direction);
  }
  slider.moveTo(valueIndex.value, target, 'keyboard', event);
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
    :inputProps="inputProps()"
    :inputRef="setInput"
  />
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
    <input v-bind="inputProps()" :ref="setInput" />
  </div>
</template>
