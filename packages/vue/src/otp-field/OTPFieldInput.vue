<script setup lang="ts">
import { computed, mergeProps, useAttrs, watch, type InputHTMLAttributes } from 'vue';
import { useElement } from '../common/element';
import { platform } from '../common/platform';
import { fieldStateAttributes } from '../field/control';
import { injectOTPFieldRoot } from './root';
import type { OTPFieldInputState } from './types';

// The type of `autocomplete` in `InputHTMLAttributes` is a union that is too large for vue-tsc.
type Attributes = Omit<InputHTMLAttributes, 'autocomplete'> & { autocomplete?: string | null };

defineOptions({ inheritAttrs: false });

defineProps</* @vue-ignore */ Attributes>();

defineSlots<{
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: OTPFieldInputState;
  }): unknown;
}>();

const root = injectOTPFieldRoot();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLInputElement>();

const claimed = root.claimIndex();
const index = computed(() => {
  const mounted = root.indexOf(element.value);
  return mounted >= 0 ? mounted : claimed;
});
const character = computed(() => root.characters[index.value] ?? '');
const state = computed<OTPFieldInputState>(() => ({
  ...root.state,
  filled: character.value !== '',
  value: character.value,
  index: index.value,
}));
// Some Android keyboards send all text as a composition, so Android takes each `input` event.
let composing = false;

watch(
  element,
  (el, _, onCleanup) => {
    if (el) onCleanup(root.addSlot(el));
  },
  { flush: 'post' },
);

defineExpose({ element });

function elementProps() {
  const at = index.value;
  const named = 'aria-label' in attrs || 'aria-labelledby' in attrs;
  // Vue before 3.5.14 sets the key `autocorrect` as a Boolean DOM property, and `off` then turns
  // autocorrect on. Vue sets the key `autoCorrect` as an attribute. Two keys would give a server
  // two attributes.
  const { autocorrect, ...given } = attrs;
  return mergeProps(
    {
      type: 'text',
      id: at === 0 ? root.id : `${root.id}-${at + 1}`,
      value: character.value,
      inputmode: root.inputmode,
      // A password manager shows its list at each input with `autocomplete` or `maxlength`.
      autocomplete: at === 0 ? root.autocomplete : 'off',
      maxlength: at === 0 ? root.maxlength : undefined,
      autoCorrect: autocorrect === undefined ? 'off' : autocorrect,
      spellcheck: 'false',
      tabindex: root.tabStop === at ? 0 : -1,
      form: root.form,
      disabled: root.state.disabled,
      readonly: root.state.readonly,
      required: root.state.required,
      'aria-labelledby': named ? undefined : root.labelledBy,
      'aria-invalid': root.state.valid === false ? 'true' : undefined,
      ...fieldStateAttributes(state.value),
      'data-invalid': undefined,
      'data-complete': root.state.complete ? '' : undefined,
      onMousedown,
      onFocus,
      onInput,
      onKeydown,
      onPaste,
      onCompositionstart,
      onCompositionend,
    },
    given,
  );
}

function inputOf(event: Event) {
  return event.currentTarget as HTMLInputElement;
}

// The press would put a caret in the character, also on the slot that has the focus, which gets no
// `focus` event. The slot takes the focus itself, and the focus selects the character.
function onMousedown(event: MouseEvent) {
  event.preventDefault();
  root.focusSlot(index.value);
}

function onFocus(event: FocusEvent) {
  root.onFocus(index.value, inputOf(event));
}

function onInput(event: Event) {
  if (!composing) root.enter(index.value, inputOf(event).value, 'input-change', event);
}

function onPaste(event: ClipboardEvent) {
  event.preventDefault();
  root.enter(index.value, event.clipboardData?.getData('text/plain') ?? '', 'input-paste', event);
}

function onCompositionstart() {
  if (!platform.os.android) composing = true;
}

function onCompositionend(event: CompositionEvent) {
  composing = false;
  root.enter(index.value, inputOf(event).value, 'input-change', event);
}

function onKeydown(event: KeyboardEvent) {
  // WebKit sends a key with the code 229 after `compositionend`.
  if (composing || event.keyCode === 229) return;
  const at = index.value;
  const { end } = root;
  const boundary = (event.ctrlKey || event.metaKey) && !event.altKey;
  const rtl = getComputedStyle(inputOf(event)).direction === 'rtl';
  const targets: Record<string, number> = {
    [rtl ? 'ArrowRight' : 'ArrowLeft']: boundary ? 0 : Math.max(at - 1, 0),
    [rtl ? 'ArrowLeft' : 'ArrowRight']: boundary ? end : Math.min(at + 1, end),
    Home: 0,
    ArrowUp: 0,
    End: end,
    ArrowDown: end,
  };
  const target = targets[event.key];
  if (target !== undefined) {
    event.preventDefault();
    root.focusSlot(target);
  } else if (event.key === 'Enter') {
    root.onEnter(inputOf(event));
  } else if (event.key === 'Backspace' || event.key === 'Delete') {
    event.preventDefault();
    root.remove(at, event.key, event.key === 'Backspace' && boundary, event);
  }
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
