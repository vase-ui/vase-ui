<script setup lang="ts">
import { computed, mergeProps, nextTick, provide, useAttrs, watch } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { chipKey, createComboboxDetails, injectChipsOf, injectComboboxRoot } from './root';
import type { ComboboxChipProps, ComboboxChipState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<ComboboxChipProps>();
defineSlots<{
  default?(scope: { state: ComboboxChipState }): unknown;
  element?(scope: ElementSlotProps<ComboboxChipState>): unknown;
}>();

const context = injectComboboxRoot('Chip');
const chips = injectChipsOf('Chip');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
watch(
  element,
  (el, _, onCleanup) => {
    if (el) onCleanup(chips.addChip(el));
  },
  { flush: 'post' },
);

const disabled = computed(() => context.disabled);
const state = computed<ComboboxChipState>(() => ({
  disabled: disabled.value,
  readonly: context.readonly,
}));
provide(chipKey, {
  get element() {
    return element.value;
  },
  get disabled() {
    return disabled.value;
  },
});

/** Removes the value of the chip. */
function remove(event: Event) {
  const el = element.value;
  const values = context.value;
  if (!el || !Array.isArray(values) || context.readonly || disabled.value) return;
  const index = chips.indexOf(el);
  if (index === -1) return;
  const removed = values[index];
  if (
    !context.setValue(
      values.filter((_, at) => at !== index),
      createComboboxDetails('none', event),
    )
  )
    return;
  context.unhighlight(removed, event);
}

function onKeydown(event: KeyboardEvent) {
  if (event.target !== event.currentTarget || event.ctrlKey || event.altKey || event.metaKey) {
    return;
  }
  // The chips of a disabled or read-only root take no key.
  if (disabled.value || context.readonly) return;
  const el = element.value;
  if (!el) return;
  const index = chips.indexOf(el);
  const [forward, back] = chips.rtl() ? ['ArrowLeft', 'ArrowRight'] : ['ArrowRight', 'ArrowLeft'];
  const input = context.input;
  if (event.key === forward || event.key === back) {
    event.preventDefault();
    const next = index + (event.key === forward ? 1 : -1);
    if (next >= 0 && !chips.focusChip(next)) input?.focus();
    return;
  }
  if ((event.key === 'Backspace' || event.key === 'Delete') && Array.isArray(context.value)) {
    event.preventDefault();
    remove(event);
    // The focus goes to the chip in its place, else the chip before it, else the input, after the
    // chips render the new value.
    void nextTick(() => {
      if (!chips.focusChip(index) && !(index > 0 && chips.focusChip(index - 1))) input?.focus();
    });
    return;
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    context.openByKey(event);
    // An input that renders only while the popup is open mounts in this update.
    void nextTick(() => context.input?.focus());
    return;
  }
  // Enter and Space go to the input and type nothing. A character goes to the input and types.
  if (event.key === 'Enter' || event.key === ' ') event.preventDefault();
  if (event.key === 'Enter' || event.key.length === 1) input?.focus();
}

// A chip that takes the focus closes the popup.
function onFocus(event: FocusEvent) {
  if (context.root.open) context.request(false, 'none', event);
}

function elementProps() {
  return mergeProps(
    {
      tabindex: -1,
      'data-disabled': disabled.value ? '' : undefined,
      'data-readonly': context.readonly ? '' : undefined,
      onKeydown,
      onFocus,
    },
    attrs,
  );
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
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
