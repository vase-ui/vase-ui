<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs } from 'vue';
import { useDeferredServerRender } from '../common/deferredServerRender';
import { useAsTag, useElement, type ElementSlotProps } from '../common/element';
import { givenId } from '../common/id';
import { controlAttributes, joinDescribedBy, useControlId } from '../field/control';
import { isInPopup } from '../popup/layer';
import { usePopupTrigger } from '../popup/trigger';
import { injectSelectRoot } from './root';
import type { SelectTriggerProps, SelectTriggerState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectTriggerProps>(), { disabled: false });
defineSlots<{
  default?(scope: { state: SelectTriggerState }): unknown;
  element?(scope: ElementSlotProps<SelectTriggerState>): unknown;
}>();

const context = injectSelectRoot('Trigger');
const { root, field } = context;
// The trigger names a label and the messages of a field, which can come after it.
useDeferredServerRender();
const attrs = useAttrs();
// Nuxt removes `onUnmounted` from its server build, with its arguments.
const removeTriggerName = context.addTriggerName(attrs);
onUnmounted(removeTriggerName);
const { element, setElement } = useElement<HTMLElement>();
// A trigger with its own `id` gives it to the field. Else the root gives its `id` to the field.
const triggerId = useControlId(
  givenId(props.id) ? field : null,
  () => props.id,
  () => context.triggerId,
);
const trigger = usePopupTrigger(() => root, {
  element,
  id: () => triggerId.value,
  payload: () => undefined,
  disabled: () => props.disabled || context.disabled,
  tag: useAsTag(() => props.as, 'button'),
  pressStart: () => true,
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

function onPointerdown(event: PointerEvent) {
  if (trigger.onPointerdown(event) && element.value) {
    context.press.start(event, element.value, { item: 400 });
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.defaultPrevented) return;
  if (root.open) {
    // The trigger can keep the focus of a native label after the open. Its keys go to the list.
    context.focus.onTriggerKeydown(event);
    if (!context.list.onKeydown(event)) context.typeahead.onKeydown(event);
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
  if (!root.open) return;
  // An aligned popup covers the trigger.
  if (context.aligned.value) root.request(false, 'none', event);
  // The highlight follows the focus, and the trigger has the focus.
  else if (context.list.highlighted) context.list.highlight(null, 'none');
}

function onBlur(event: FocusEvent) {
  const next = event.relatedTarget as Element | null;
  if (next && isInPopup(context.layer, next)) return;
  // A string of the typeahead ends when the focus leaves the select.
  context.typeahead.reset();
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
      // Base UI marks the trigger of an open select as pressed, also after a key open.
      'data-pressed': open ? '' : undefined,
      'data-popup-side': state.value.popupSide ?? undefined,
      'data-placeholder': state.value.placeholder ? '' : undefined,
      onClick: trigger.onClick,
      onPointerdown,
      onMousedown: trigger.onMousedown,
      onFocus,
      onBlur,
    },
    joinDescribedBy(attrs, field),
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
