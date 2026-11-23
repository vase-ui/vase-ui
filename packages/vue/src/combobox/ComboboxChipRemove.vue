<script setup lang="ts">
import { computed, inject, useAttrs } from 'vue';
import { useButton } from '../common/button';
import { createError } from '../common/createError';
import { useAsTag, useElement, type ElementSlotProps } from '../common/element';
import { chipKey, createComboboxDetails, injectChipsOf, injectComboboxRoot } from './root';
import type { ComboboxChipRemoveProps, ComboboxChipRemoveState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxChipRemoveProps>(), { disabled: false });
defineSlots<{
  default?(scope: { state: ComboboxChipRemoveState }): unknown;
  element?(scope: ElementSlotProps<ComboboxChipRemoveState>): unknown;
}>();

const context = injectComboboxRoot('ChipRemove');
const chips = injectChipsOf('ChipRemove');
const chip = inject(chipKey, null) ?? missingChip();

function missingChip(): never {
  throw createError(11);
}
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const button = useButton({
  element,
  disabled: () => chip.disabled || props.disabled,
  type: 'button',
  tag: useAsTag(() => props.as, 'button'),
});
const state = computed<ComboboxChipRemoveState>(() => ({ disabled: button.disabled.value }));

// Removes the value of the chip, and gives the focus to the input.
function onClick(event: MouseEvent) {
  const el = chip.element;
  const values = context.value;
  if (!el || !Array.isArray(values) || context.readonly) return;
  const index = chips.indexOf(el);
  if (index === -1) return;
  const details = createComboboxDetails('chip-remove-press', event);
  const removed = values[index];
  if (
    context.setValue(
      values.filter((_, at) => at !== index),
      details,
    )
  ) {
    context.unhighlight(removed, event);
  }
  context.input?.focus();
  if (!details.isPropagationAllowed) event.stopPropagation();
}

function elementProps() {
  return button.mergeAttributes(
    {
      tabindex: -1,
      // The input keeps the focus (test/measurements/combobox.test.ts, "a press in a popup while a
      // text input has the focus").
      onMousedown: (event: MouseEvent) => event.preventDefault(),
      onClick,
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
  <button v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </button>
</template>
