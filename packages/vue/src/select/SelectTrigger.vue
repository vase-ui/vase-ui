<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { useDeferredServerRender } from '../common/deferredServerRender';
import { useAsTag, useElement } from '../common/element';
import { givenId } from '../common/id';
import { controlAttributes, describedByWith } from '../field/control';
import { isInPopup } from '../popup/layer';
import { usePopupTrigger } from '../popup/trigger';
import { injectSelectRoot } from './root';
import type { SelectTriggerProps, SelectTriggerState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectTriggerProps>(), { disabled: false });
defineSlots<{
  default?(scope: { state: SelectTriggerState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: SelectTriggerState;
  }): unknown;
}>();

const context = injectSelectRoot('Trigger');
const { root, field } = context;
// The trigger names a label and the messages of a field, which can come after it.
useDeferredServerRender();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const triggerId = computed(() => givenId(props.id) ?? context.triggerId);
const trigger = usePopupTrigger(() => root, {
  element,
  id: () => triggerId.value,
  payload: () => undefined,
  disabled: () => props.disabled || context.disabled,
  tag: useAsTag(() => props.as),
  pressAtPointerdown: true,
  keyClickByKeydown: true,
});

const state = computed<SelectTriggerState>(() => ({
  open: root.open,
  disabled: trigger.button.disabled.value,
  readonly: context.readonly,
  required: context.required,
  placeholder: !context.hasValue,
  value: context.value,
  popupSide: root.open ? context.side.value : null,
  touched: field?.state.touched ?? false,
  dirty: field?.state.dirty ?? false,
  valid: field?.state.valid ?? null,
  filled: field?.state.filled ?? false,
}));

let toggled = false;

function onPointerdown(event: PointerEvent) {
  const wasOpen = root.open;
  trigger.onPointerdown(event);
  toggled = root.open !== wasOpen;
  if (!wasOpen && root.open && element.value) context.press.start(event, element.value);
}

// The popup that a press opened takes the focus before the `mousedown` of the press, and the
// button of WebKit takes no focus at a press (test/measurements/select.test.ts). So no button
// takes it.
function onMousedown(event: MouseEvent) {
  if (toggled) event.preventDefault();
  toggled = false;
}

function onKeydown(event: KeyboardEvent) {
  if (event.defaultPrevented) return;
  if (root.open) {
    context.focus.onTriggerKeydown(event);
    return;
  }
  if (trigger.button.disabled.value) return;
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    context.openKey = event.key;
    root.request(true, 'list-navigation', event, element.value);
    return;
  }
  // A key on a closed native select selects the next option whose text starts with it
  // (test/measurements/select.test.ts).
  if (!context.multiple && !context.readonly && context.typeahead.onKeydown(event)) return;
  trigger.onKeydown(event);
}

function onFocus(event: FocusEvent) {
  context.keep();
  // An aligned popup covers the trigger.
  if (root.open && context.aligned.value) root.request(false, 'none', event);
}

function onBlur(event: FocusEvent) {
  const next = event.relatedTarget as Element | null;
  if (next && isInPopup(context.layer, next)) return;
  if (element.value) field?.onLeave(element.value);
}

function elementProps() {
  const open = root.open;
  const merged = trigger.button.mergeAttributes(
    {
      ...(field && controlAttributes(field)),
      id: triggerId.value,
      role: 'combobox',
      'aria-haspopup': 'listbox',
      'aria-expanded': open ? 'true' : 'false',
      // The list, else the popup. A popup with a list is no listbox.
      'aria-controls': open ? (context.listId.value ?? context.popupId.value) : undefined,
      'aria-labelledby': field?.labelId ?? context.labelId,
      'aria-readonly': context.readonly ? 'true' : undefined,
      'aria-required': context.required ? 'true' : undefined,
      'data-pressed': open && root.reason === 'trigger-press' ? '' : undefined,
      'data-popup-side': state.value.popupSide ?? undefined,
      'data-placeholder': state.value.placeholder ? '' : undefined,
      onClick: trigger.onClick,
      onPointerdown,
      onMousedown,
      onFocus,
      onBlur,
    },
    field
      ? { ...attrs, 'aria-describedby': describedByWith(field, attrs['aria-describedby']) }
      : attrs,
  );
  // A key listener of the developer that prevents the default stops the keys of the select.
  return mergeProps(merged, { onKeydown });
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
