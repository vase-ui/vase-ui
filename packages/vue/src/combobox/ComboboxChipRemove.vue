<script setup lang="ts">
import { computed, inject, useAttrs } from 'vue';
import { useButton } from '../common/button';
import { useAsTag, useElement } from '../common/element';
import { chipKey, chipsKey, createComboboxDetails, injectComboboxRoot } from './root';
import type { ComboboxChipRemoveProps, ComboboxChipRemoveState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxChipRemoveProps>(), { disabled: false });
defineSlots<{
  default?(scope: { state: ComboboxChipRemoveState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ComboboxChipRemoveState;
  }): unknown;
}>();

const context = injectComboboxRoot('ChipRemove');
const chips = inject(chipsKey, null);
const chip = inject(chipKey, null);
if (!chip || !chips) {
  throw new Error(
    'Vase UI: <Combobox.ChipRemove> must be inside <Combobox.Chip>. Without a chip the button has no value to remove. Put the button inside <Combobox.Chip>.',
  );
}
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const button = useButton({
  element,
  disabled: () => chip.disabled || props.disabled,
  type: 'button',
  tag: useAsTag(() => props.as),
});
const state = computed<ComboboxChipRemoveState>(() => ({ disabled: button.disabled.value }));

// Removes the value of the chip, and gives the focus to the input.
function onClick(event: MouseEvent) {
  const el = chip!.element;
  if (!el || context.readonly) return;
  const index = chips!.indexOf(el);
  if (index === -1) return;
  const details = createComboboxDetails('chip-remove-press', event);
  context.setValue(
    (context.value as unknown[]).filter((_, at) => at !== index),
    details,
  );
  context.input?.focus();
  if (!details.isPropagationAllowed) event.stopPropagation();
}

function elementProps() {
  return button.mergeAttributes(
    {
      tabindex: -1,
      // The input keeps the focus (test/measurements/combobox.test.ts, C1).
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
