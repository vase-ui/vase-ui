<script setup lang="ts">
import { computed, inject, mergeProps, onScopeDispose, useAttrs, useId, watch } from 'vue';
import { useDeferredServerRender } from '../common/deferredServerRender';
import { useAsTag, useElement } from '../common/element';
import { givenId } from '../common/id';
import { controlAttributes, describedByWith, fieldKey, fieldStateAttributes } from '../field/control';
import { nextTextMatch, TYPEAHEAD_RESET_MS } from '../list/typeahead';
import { interactionOf } from '../popup/root';
import { isMouseClick, usePopupTrigger } from '../popup/trigger';
import { createComboboxDetails, injectComboboxRoot, useTriggerIsControl } from './root';
import type { ComboboxTriggerProps, ComboboxTriggerState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxTriggerProps>(), { disabled: false });
defineSlots<{
  default?(scope: { state: ComboboxTriggerState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ComboboxTriggerState;
  }): unknown;
}>();

const context = injectComboboxRoot('Trigger');
const field = inject(fieldKey, null);
// The label and the messages of the field can come after the trigger.
useDeferredServerRender();
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const { root } = context;
const isControl = useTriggerIsControl(context);
const id = computed(() => givenId(props.id) ?? (isControl.value ? context.controlId : generatedId));

const trigger = usePopupTrigger(() => (isControl.value ? root : null), {
  element,
  id: () => id.value,
  payload: () => undefined,
  disabled: () => context.disabled || props.disabled,
  tag: useAsTag(() => props.as),
  pressStart: () => true,
});
const isDisabled = trigger.button.disabled;

watch(element, (el, _, onCleanup) => onCleanup(context.setTrigger(el)), {
  flush: 'sync',
  immediate: true,
});
// Beside an input, the trigger is inside the layer, and the input is the trigger of the popup.
let removeInside: (() => void) | undefined;
watch(
  isControl,
  (control) => {
    removeInside?.();
    removeInside = control ? undefined : context.addInside(() => element.value);
  },
  { immediate: true },
);
onScopeDispose(() => removeInside?.());

const state = computed<ComboboxTriggerState>(() => ({
  open: root.open,
  disabled: isDisabled.value,
  readonly: context.readonly,
  popupSide: context.popupSide,
  listEmpty: context.empty,
  placeholder: context.mode !== 'none' && !context.hasValue,
  touched: field?.state.touched ?? false,
  dirty: field?.state.dirty ?? false,
  valid: field?.state.valid ?? null,
  filled: field?.state.filled ?? false,
}));

function inputElement() {
  return context.control as HTMLElement | null;
}

// A press of the main mouse button acts at `pointerdown`, so the user can drag to an item.
let openedByPress = false;
function onPointerdown(event: PointerEvent) {
  openedByPress = false;
  if (isDisabled.value || event.pointerType !== 'mouse' || event.button !== 0) return;
  const wasOpen = root.open;
  if (isControl.value) trigger.onPointerdown(event);
  else pressBesideInput(event);
  openedByPress = !wasOpen && root.open;
  if (openedByPress) context.startDrag(event);
}

function onClick(event: MouseEvent) {
  if (isControl.value) trigger.onClick(event);
  else if (!isDisabled.value && !isMouseClick(event)) pressBesideInput(event);
}

function pressBesideInput(event: MouseEvent) {
  context.request(!root.open, 'trigger-press', event);
  // A mouse and a pen move the focus to the input. A touch opens no software keyboard.
  const input = inputElement();
  if (interactionOf(event) !== 'touch') input?.focus({ preventScroll: true });
}

function onMousedown(event: MouseEvent) {
  // The input keeps the focus (test/measurements/combobox.test.ts, C1). The popup that this press
  // opened has the focus, which the button would take at `mousedown`.
  if (!isControl.value || openedByPress) event.preventDefault();
  openedByPress = false;
}

// The typeahead of a closed trigger: a typed character selects the next item whose label starts
// with the typed string.
let typed = '';
let typedFrom = -1;
let typedTimer: ReturnType<typeof setTimeout> | undefined;
onScopeDispose(() => clearTimeout(typedTimer));

function typeahead(event: KeyboardEvent) {
  if (context.mode !== 'single' || context.readonly || root.open) return;
  if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.key === ' ' && typed === '') return;
  const values = context.data
    ? context.dataValues
    : context.list.items().map((item) => context.valueOf(item));
  const current = values.findIndex((value) => context.isSelected(value));
  if (typed === '') typedFrom = current;
  typed += event.key;
  clearTimeout(typedTimer);
  typedTimer = setTimeout(() => (typed = ''), TYPEAHEAD_RESET_MS);
  if (event.key === ' ') event.preventDefault();
  const index = nextTextMatch(
    values.map((value) => context.labelOf(value)),
    typed,
    typedFrom,
    current,
  );
  if (index !== -1 && index !== current) {
    context.setValue(values[index], createComboboxDetails('none', event));
  }
}

function onKeydown(event: KeyboardEvent) {
  if (isDisabled.value) return;
  if (event.key === 'Tab' && root.open && isControl.value) {
    context.focus.onTriggerKeydown(event);
    return;
  }
  if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !root.open) {
    event.preventDefault();
    context.openByKey(event);
    return;
  }
  if (isControl.value) typeahead(event);
}

function elementProps() {
  const open = root.open;
  const own: Record<string, unknown> = isControl.value
    ? {
        role: 'combobox',
        tabindex: 0,
        'aria-haspopup': 'dialog',
        'aria-controls': open && root.popup ? root.popup.id || undefined : undefined,
        'aria-required': context.required ? 'true' : undefined,
        'aria-readonly': context.readonly ? 'true' : undefined,
        'aria-labelledby':
          [context.labelId, field?.labelledBy].filter(Boolean).join(' ') || undefined,
        ...(field && controlAttributes(field)),
      }
    : {
        tabindex: -1,
        'aria-haspopup': 'listbox',
        'aria-controls': open ? context.listId : undefined,
        ...(field && fieldStateAttributes(field.state)),
      };
  Object.assign(own, {
    id: id.value,
    'aria-expanded': open ? 'true' : 'false',
    'data-popup-side': context.popupSide ?? undefined,
    'data-list-empty': context.empty ? '' : undefined,
    'data-readonly': context.readonly ? '' : undefined,
    'data-required': context.required ? '' : undefined,
    'data-placeholder': state.value.placeholder ? '' : undefined,
    onPointerdown,
    onMousedown,
    onClick,
    onKeydown,
    onBlur: (event: FocusEvent) => {
      const to = event.relatedTarget as Element | null;
      if (field && isControl.value && !(to && root.popup?.contains(to))) {
        field.onLeave(event.currentTarget as Element);
      }
    },
  });
  const merged = trigger.button.mergeAttributes(own, attrs);
  if (isControl.value && field) {
    merged['aria-describedby'] = describedByWith(field, attrs['aria-describedby']);
  }
  return mergeProps(merged);
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
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <button v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </button>
</template>
