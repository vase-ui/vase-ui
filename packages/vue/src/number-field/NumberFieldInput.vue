<script setup lang="ts">
import { computed, mergeProps, onMounted, shallowRef, useAttrs, useId, watch } from 'vue';
import { useDeferredServerRender } from '../common/deferredServerRender';
import { useElement, type ElementSlotProps } from '../common/element';
import { givenId } from '../common/id';
import { submitAtEnter } from '../common/implicitSubmission';
import { platform } from '../common/platform';
import { controlAria, joinDescribedBy } from '../field/control';
import { injectNumberFieldRoot, stateAttributes } from './root';
import type { NumberFieldInputProps, NumberFieldInputState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<NumberFieldInputProps>();
defineSlots<{
  element?(scope: ElementSlotProps<NumberFieldInputState>): unknown;
}>();

const root = injectNumberFieldRoot('Input');
const attrs = useAttrs();
// The label and the messages of the field can come after the input.
useDeferredServerRender();
const generatedId = useId();
const { element, setElement } = useElement<HTMLInputElement>();
const elementId = computed(() => givenId(props.id) ?? root.field?.controlId ?? generatedId);
// The numeric keyboard of iOS has no decimal key and no minus key. The server cannot know the
// platform, so the input changes the mode after the mount.
const ios = shallowRef(false);
let composing = false;
let textBeforeComposition = '';

onMounted(() => (ios.value = platform.os.ios));

watch(
  element,
  (el, _, onCleanup) => {
    if (!el) return;
    onCleanup(
      root.setInput({
        element: el,
        get id() {
          return elementId.value;
        },
      }),
    );
  },
  { flush: 'post' },
);

defineExpose({ element });

const ownProps = computed(() => {
  const { state, min, max, field } = root;
  const { value } = state;
  const outOfRange =
    value !== null && ((min !== undefined && value < min) || (max !== undefined && value > max));
  return {
    type: 'text',
    role: 'spinbutton',
    id: elementId.value,
    form: root.form,
    value: state.inputValue,
    inputmode: ios.value ? (root.negative ? 'text' : 'decimal') : 'numeric',
    autocomplete: 'off',
    spellcheck: 'false',
    required: state.required,
    readonly: state.readonly,
    disabled: state.disabled,
    'aria-valuenow': value ?? undefined,
    'aria-valuetext': value === null ? undefined : state.inputValue,
    'aria-valuemin': min,
    'aria-valuemax': max,
    ...(field && controlAria(field)),
    'aria-invalid': state.valid === false || outOfRange ? 'true' : undefined,
    ...stateAttributes(state, ['disabled', 'readonly', 'required', 'invalid']),
    onBeforeinput,
    onInput,
    onFocus: () => root.startEdit(),
    onBlur: (event: FocusEvent) => root.endEdit(event),
    onWheel,
    onCompositionstart,
    onCompositionend,
  };
});

function elementProps() {
  // A step and the submit at Enter are default actions of a key, so they come after the listeners
  // of the developer, which can prevent them.
  return mergeProps(ownProps.value, joinDescribedBy(attrs, root.field), { onKeydown });
}

/** Shows the text of the field again, after an edit that the field refused. */
function showText(el: HTMLInputElement) {
  el.value = root.state.inputValue;
}

function onBeforeinput(event: InputEvent) {
  const data = event.data ?? event.dataTransfer?.getData('text/plain');
  if (!data) return;
  const el = event.currentTarget as HTMLInputElement;
  const { value, selectionStart, selectionEnd } = el;
  const next =
    value.slice(0, selectionStart ?? value.length) +
    data +
    value.slice(selectionEnd ?? value.length);
  const { text } = root;
  if (
    !text.accepts(next, root.negative) ||
    (event.inputType === 'insertFromPaste'
      ? text.parse(next) === undefined
      : text.hasDuplicates(next))
  ) {
    event.preventDefault();
  }
}

function onInput(event: Event) {
  const el = event.currentTarget as HTMLInputElement;
  if (composing || (event as InputEvent).isComposing) {
    root.holdText(el.value);
    return;
  }
  // A removal, or an edit that the browser did not let the part cancel.
  if (!root.text.accepts(el.value, root.negative)) {
    showText(el);
    return;
  }
  const paste = (event as InputEvent).inputType === 'insertFromPaste';
  root.edit(el.value, paste ? 'input-paste' : 'input-change', event);
}

function onCompositionstart(event: CompositionEvent) {
  composing = true;
  textBeforeComposition = (event.currentTarget as HTMLInputElement).value;
}

// WebKit sends the last `input` of a composition after `compositionend`, and Chromium before it
// (measured), so the part reads the text at `compositionend`.
function onCompositionend(event: CompositionEvent) {
  composing = false;
  const el = event.currentTarget as HTMLInputElement;
  if (root.text.accepts(el.value, root.negative)) {
    root.edit(el.value, 'input-change', event);
  } else {
    root.holdText(textBeforeComposition);
  }
}

function onKeydown(event: KeyboardEvent) {
  // WebKit gives `isComposing` as false on a key of a composition (WebKit bug 165004).
  if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
  if (event.key === 'Enter') {
    // The hidden input is a second field for the browser (test/measurements/number-field.test.ts).
    submitAtEnter(event, [event.currentTarget as Element, root.hiddenInput]);
    return;
  }
  const { state, min, max } = root;
  if (event.ctrlKey || event.metaKey || state.disabled || state.readonly) return;
  if (event.key === 'Home' || event.key === 'End') {
    const bound = event.key === 'Home' ? min : max;
    if (bound === undefined || event.altKey) return;
    event.preventDefault();
    if (bound !== state.value && root.change(bound, 'keyboard', event)) {
      root.commit(bound, 'keyboard', event);
    }
    return;
  }
  const direction = event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0;
  if (direction === 0) return;
  event.preventDefault();
  const next = root.step(direction, event, 'keyboard', event);
  if (next !== undefined) root.commit(next, 'keyboard', event);
}

function onWheel(event: WheelEvent) {
  const { state } = root;
  if (!root.allowWheelScrub || state.disabled || state.readonly || event.ctrlKey) return;
  if (!(event.currentTarget as Element).matches(':focus')) return;
  // With Shift, a browser can give the wheel on the horizontal axis.
  const vertical = Math.abs(event.deltaY) >= Math.abs(event.deltaX);
  const delta = vertical ? event.deltaY : event.shiftKey ? event.deltaX : 0;
  if (delta === 0) return;
  event.preventDefault();
  const next = root.step(delta < 0 ? 1 : -1, event, 'wheel', event);
  if (next !== undefined) root.commit(next, 'wheel', event);
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="root.state"
  />
  <input v-else v-bind="elementProps()" :ref="setElement" />
</template>
