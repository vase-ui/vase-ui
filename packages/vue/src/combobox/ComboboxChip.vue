<script setup lang="ts">
import { computed, inject, mergeProps, nextTick, provide, useAttrs, watch } from 'vue';
import { useElement } from '../common/element';
import { chipKey, chipsKey, createComboboxDetails, injectComboboxRoot } from './root';
import type { ComboboxChipProps, ComboboxChipState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<ComboboxChipProps>();
defineSlots<{
  default?(scope: { state: ComboboxChipState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ComboboxChipState;
  }): unknown;
}>();

const context = injectComboboxRoot('Chip');
const chips = inject(chipsKey, null);
if (!chips) {
  throw new Error(
    'Vase UI: <Combobox.Chip> must be inside <Combobox.Chips>. Without the chips the chip has no value. Put the chip inside <Combobox.Chips>.',
  );
}
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
const state = computed<ComboboxChipState>(() => ({ disabled: disabled.value }));
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
  const values = context.value as unknown[];
  if (!el || context.readonly || disabled.value) return;
  const index = chips!.indexOf(el);
  if (index === -1) return;
  context.setValue(
    values.filter((_, at) => at !== index),
    createComboboxDetails('none', event),
  );
}

function onKeydown(event: KeyboardEvent) {
  if (event.target !== event.currentTarget || event.ctrlKey || event.altKey || event.metaKey) {
    return;
  }
  const el = element.value!;
  const index = chips!.indexOf(el);
  const [forward, back] = chips!.rtl() ? ['ArrowLeft', 'ArrowRight'] : ['ArrowRight', 'ArrowLeft'];
  const input = context.input;
  if (event.key === forward || event.key === back) {
    event.preventDefault();
    const next = index + (event.key === forward ? 1 : -1);
    const count = (context.value as unknown[]).length;
    if (next >= count) input?.focus();
    else if (next >= 0) chips!.focusChip(next);
    return;
  }
  if (event.key === 'Backspace' || event.key === 'Delete') {
    event.preventDefault();
    remove(event);
    // The focus goes to the chip in its place, else the chip before it, else the input, after the
    // chips render the new value.
    void nextTick(() => {
      const next = Math.min(index, (context.value as unknown[]).length - 1);
      if (next >= 0) chips!.focusChip(next);
      else input?.focus();
    });
    return;
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    if (!context.disabled) context.openByKey(event);
    return;
  }
  // Enter, Space and a character go to the input.
  if (event.key === 'Enter' || event.key.length === 1) input?.focus();
}

// A chip that takes the focus closes the popup.
function onFocus(event: FocusEvent) {
  if (context.root.open) context.request(false, 'none', event);
}

function elementProps() {
  return mergeProps(
    { tabindex: -1, 'data-disabled': disabled.value ? '' : undefined, onKeydown, onFocus },
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
