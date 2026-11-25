<script setup lang="ts">
import {
  computed,
  inject,
  mergeProps,
  onUnmounted,
  provide,
  shallowRef,
  useAttrs,
  useId,
  watch,
} from 'vue';
import { useAfterRender } from '../common/afterRender';
import { useDeferredServerRender } from '../common/deferredServerRender';
import { useElement, type ElementSlotProps } from '../common/element';
import { useIsHydrated } from '../common/hydration';
import { ownerWindow } from '../common/owner';
import { platform } from '../common/platform';
import { controlAttributes, fieldKey, joinDescribedBy, useControlId } from '../field/control';
import { isComposing, isInPopup } from '../popup/layer';
import {
  createComboboxDetails,
  injectChips,
  injectComboboxRoot,
  useInPopup,
  type ChipsContext,
} from './root';
import type { ComboboxInputProps, ComboboxInputState } from './types';

type TextElement = HTMLInputElement | HTMLTextAreaElement;

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxInputProps>(), { disabled: false });
defineSlots<{
  element?(scope: ElementSlotProps<ComboboxInputState>): unknown;
}>();

const context = injectComboboxRoot('Input');
const chips = injectChips();
const inPopup = useInPopup();
const field = inject(fieldKey, null);
// An input in the popup is no control of the field.
if (inPopup) provide(fieldKey, null);
// The label and the messages of the field can come after the input.
useDeferredServerRender();
const attrs = useAttrs();
const generatedId = useId();
const mounted = useIsHydrated();
const { element, setElement } = useElement<TextElement>();
const afterRender = useAfterRender();
const { root, list } = context;

// Nuxt removes `onUnmounted` from its server build, with its arguments.
const removeInput = context.addInput({
  insidePopup: inPopup,
  get element() {
    return element.value;
  },
  attrs,
  showText,
});
onUnmounted(removeInput);

const isControl = computed(() => !inPopup || context.inline);
const isDisabled = computed(() => context.disabled || props.disabled);
const elementId = useControlId(
  isControl.value ? field : null,
  () => props.id,
  () => (isControl.value ? context.controlId : generatedId),
);
// A `<textarea>` in the slot has the role only while the list shows (VUE-97). The server HTML and
// the first render have the attributes of an `<input>`.
const isInput = computed(
  () => !mounted.value || !element.value || element.value.localName === 'input',
);
const expanded = computed(() => inPopup || context.expanded);

// The control is the trigger of the popup.
watch(
  [element, isControl],
  ([el, control], _, onCleanup) => {
    if (!el || !control) return;
    onCleanup(
      root.addTrigger({
        get id() {
          return elementId.value;
        },
        element: el,
        payload: undefined,
        get disabled() {
          return isDisabled.value;
        },
      }),
    );
  },
  { flush: 'post', immediate: true },
);

const state = computed<ComboboxInputState>(() => ({
  open: root.open,
  popupSide: context.popupSide,
  listEmpty: context.empty,
  readonly: context.readonly,
  disabled: isDisabled.value,
  touched: (isControl.value && field?.state.touched) || false,
  dirty: (isControl.value && field?.state.dirty) || false,
  valid: isControl.value ? (field?.state.valid ?? null) : null,
  filled: (isControl.value && field?.state.filled) || false,
}));

// While a composition runs, the input keeps the composed text and writes no text, so the list
// does not filter half a word.
const composed = shallowRef<string | null>(null);
let compositionEnded = false;

const shown = () => (inPopup ? (context.keptText ?? context.shownText) : context.shownText);

function showText() {
  const el = element.value;
  if (el && composed.value === null && el.value !== shown()) el.value = shown();
}

function write(text: string, event: Event) {
  const hadValue = context.mode !== 'none' && context.hasValue;
  const accepted = context.setText(text, createComboboxDetails('input-change', event));
  // The parent can refuse or change a controlled text, also in its own `input` listener.
  afterRender(showText);
  if (!accepted) return;
  if (text === '' && isControl.value && !context.inline && context.mode === 'single') {
    const details = createComboboxDetails('input-clear', event);
    if (context.hasValue) context.setValue(null, details);
    if (!context.openOnInputClick) context.request(false, 'input-clear', event);
  }
  // A script and an autofill send an `input` with no `inputType`, or `insertReplacementText`
  // (test/measurements/combobox.test.ts, "the `inputType` of an `input` event"). Such a text opens
  // nothing.
  const inputType = (event as InputEvent).inputType;
  if (event.type === 'compositionend' || (inputType && inputType !== 'insertReplacementText')) {
    context.onTyped(text, event, hadValue);
  } else if (inputType === 'insertReplacementText') {
    context.onFilled(text);
  }
}

function onInput(event: Event) {
  const el = event.currentTarget as TextElement;
  if (composed.value !== null) {
    composed.value = el.value;
    return;
  }
  // WebKit sends the last `input` of a composition after `compositionend`
  // (https://bugs.webkit.org/show_bug.cgi?id=165004).
  if (compositionEnded && /Composition/.test((event as InputEvent).inputType)) return;
  write(el.value, event);
}

function onCompositionstart(event: CompositionEvent) {
  // Some Android keyboards compose each word, and a part that waits for its end never filters.
  if (platform.os.android) return;
  composed.value = (event.currentTarget as TextElement).value;
}

function onCompositionend(event: CompositionEvent) {
  if (composed.value === null) return;
  composed.value = null;
  compositionEnded = true;
  setTimeout(() => (compositionEnded = false));
  write((event.currentTarget as TextElement).value, event);
}

watch(
  () => context.shownText,
  () => {
    // A pick while a composition runs replaces the composed text.
    composed.value = null;
  },
);

function onMousedown(event: MouseEvent) {
  if (event.button !== 0 || isDisabled.value || inPopup) return;
  if (context.openOnInputClick) context.request(true, 'input-press', event);
}

// Home and End move the caret and scroll the input there, the same in each browser
// (test/measurements/combobox.test.ts, "Home and End in a text input" and "the scroll of a text
// input after a script moved the caret").
function moveCaret(el: HTMLInputElement, toEnd: boolean) {
  const at = toEnd ? el.value.length : 0;
  el.setSelectionRange(at, at);
  const rtl = ownerWindow(el).getComputedStyle(el).direction === 'rtl';
  const room = el.scrollWidth - el.clientWidth;
  el.scrollLeft = toEnd ? (rtl ? -room : room) : 0;
}

function onKeydown(event: KeyboardEvent) {
  const el = event.currentTarget as TextElement;
  const modified = event.ctrlKey || event.altKey || event.metaKey || event.shiftKey;
  if ((event.key === 'Home' || event.key === 'End') && !modified) {
    if (el.localName !== 'input') return;
    event.preventDefault();
    moveCaret(el as HTMLInputElement, event.key === 'End');
    return;
  }
  if (event.key === 'Tab' && root.open && isControl.value) {
    context.focus.onTriggerKeydown(event);
    return;
  }
  if (isDisabled.value || modified || isComposing(event)) return;
  if (event.key === 'Escape' && !root.open) {
    clearByEscape(event);
    return;
  }
  if (chips && !context.readonly && onChipsKey(event, el, chips)) return;
  if (event.key === 'Enter' || (event.key === ' ' && el.value === '')) {
    if (!expanded.value) return;
    if (context.readonly) {
      // Browsing can highlight an item, and Enter there submits no form.
      if (list.highlighted) event.preventDefault();
      return;
    }
    if (context.clickHighlighted(event)) {
      event.preventDefault();
    } else if (event.key === 'Enter' && !context.inline) {
      // With no highlight, the popup closes and the form can submit.
      context.request(false, 'none', event);
    } else if (event.key === ' ') {
      event.preventDefault();
    }
    return;
  }
  if (!expanded.value) {
    // A closed element that is not an input keeps its arrow keys (VUE-97).
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && el.localName === 'input') {
      event.preventDefault();
      context.openByKey(event);
    }
    return;
  }
  context.onListKeydown(event);
}

function clearByEscape(event: KeyboardEvent) {
  const details = createComboboxDetails('escape-key', event);
  context.setText('', details);
  if (context.mode === 'none' || !context.hasValue) return;
  const cleared = context.setValue(context.mode === 'multiple' ? [] : null, details);
  if (cleared && !context.inline && !details.isPropagationAllowed) event.stopPropagation();
}

// Backspace in an empty input removes the last value. ArrowLeft at the start goes to the last chip.
function onChipsKey(event: KeyboardEvent, el: TextElement, around: ChipsContext) {
  const values = context.value as unknown[];
  if (!Array.isArray(values) || values.length === 0) return false;
  if (event.key === 'Backspace' && el.value === '') {
    list.highlight(null, 'keyboard', event);
    context.setValue(values.slice(0, -1), createComboboxDetails('none', event));
    return true;
  }
  const back = around.rtl() ? 'ArrowRight' : 'ArrowLeft';
  if (event.key === back && el.selectionStart === 0 && el.selectionEnd === 0) {
    event.preventDefault();
    around.focusChip(-1);
    return true;
  }
  return false;
}

// The highlight of an inline list goes with the focus, and comes back with it.
let leftHighlight: typeof list.highlighted = null;
function onFocus() {
  if (!context.inline || !leftHighlight) return;
  if (list.indexOf(leftHighlight) !== -1) list.highlight(leftHighlight, 'none');
  leftHighlight = null;
}

function onBlur(event: FocusEvent) {
  if (context.inline && context.autoHighlight !== 'always' && list.highlighted) {
    leftHighlight = list.highlighted;
    list.highlight(null, 'none', event);
  }
  // A text that the user left in the input of a closed popup goes back, as at a close.
  if (isControl.value && !context.inline && !root.open) context.resetText(event);
  const to = event.relatedTarget as Element | null;
  if (field && isControl.value && !(to && isInPopup(context.layer, to))) {
    field.onLeave(event.currentTarget as Element);
  }
}

function elementProps() {
  const highlighted = list.highlighted;
  const required = context.required && isControl.value;
  const own: Record<string, unknown> = {
    id: elementId.value,
    value: composed.value ?? shown(),
    disabled: isDisabled.value,
    readonly: context.readonly,
    form: context.form,
    name: context.mode === 'none' && isControl.value ? context.name : undefined,
    required: context.mode === 'none' && required,
    'aria-required': context.mode !== 'none' && required ? 'true' : undefined,
    'aria-labelledby':
      [context.labelId, isControl.value ? field?.labelledBy : undefined]
        .filter(Boolean)
        .join(' ') || undefined,
    'data-popup-side': context.popupSide ?? undefined,
    'data-list-empty': context.empty ? '' : undefined,
    onInput,
    onCompositionstart,
    onCompositionend,
    onKeydown,
    onMousedown,
    onFocus,
    onBlur,
  };
  if (isInput.value || expanded.value) {
    Object.assign(own, {
      role: 'combobox',
      'aria-expanded': expanded.value ? 'true' : 'false',
      'aria-haspopup': context.grid ? 'grid' : 'listbox',
      'aria-controls': expanded.value ? context.listId : undefined,
      'aria-activedescendant': highlighted?.element.id || undefined,
      'aria-autocomplete': context.readonly
        ? 'none'
        : context.mode === 'none'
          ? context.completion
          : 'list',
    });
  }
  if (isInput.value) {
    Object.assign(own, {
      autocomplete: 'off',
      autocorrect: 'off',
      autocapitalize: 'none',
      spellcheck: 'false',
    });
  }
  const fieldOwn = isControl.value && field ? controlAttributes(field) : {};
  return mergeProps(fieldOwn, own, joinDescribedBy(attrs, isControl.value ? field : null));
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
  <input v-else v-bind="elementProps()" :ref="setElement" />
</template>
