<script setup lang="ts">
import { computed, onUnmounted, useAttrs } from 'vue';
import { useButton } from '../common/button';
import { useAsTag, useElement } from '../common/element';
import { useEnterAfterLeave } from '../common/useEnterAfterLeave';
import { createComboboxDetails, injectComboboxRoot } from './root';
import type { ComboboxClearProps, ComboboxClearState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxClearProps>(), {
  disabled: false,
  keepMounted: false,
});
defineSlots<{
  default?(scope: { state: ComboboxClearState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ComboboxClearState;
  }): unknown;
}>();

const context = injectComboboxRoot('Clear');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
// Nuxt removes `onUnmounted` from its server build, with its arguments.
const removeInside = context.addInside(() => element.value);
onUnmounted(removeInside);
const button = useButton({
  element,
  disabled: () => context.disabled || props.disabled,
  type: 'button',
  tag: useAsTag(() => props.as),
});

/** There is a value or a text to clear. */
const visible = computed(() => (context.mode === 'none' ? context.text !== '' : context.hasValue));
// A new button waits while the old one leaves in a `<Transition>`.
const { waiting } = useEnterAfterLeave(() => visible.value, element);
const shown = computed(() => props.keepMounted || (visible.value && !waiting.value));

const state = computed<ComboboxClearState>(() => ({
  open: context.root.open,
  disabled: button.disabled.value,
  visible: visible.value,
}));

function onClick(event: MouseEvent) {
  if (context.readonly) return;
  const details = createComboboxDetails('clear-press', event);
  context.setText('', details);
  // A press can come while there is no value: in the leave of the button, or with `keepMounted`.
  if (context.mode !== 'none' && context.hasValue) {
    context.setValue(
      context.mode === 'multiple' ? [] : null,
      createComboboxDetails('clear-press', event),
    );
  }
  context.list.highlight(null, 'none', event);
  context.input?.focus();
}

function elementProps() {
  return button.mergeAttributes(
    {
      tabindex: -1,
      'data-popup-open': context.root.open ? '' : undefined,
      hidden: visible.value ? undefined : true,
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
    v-if="shown && $slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="shown && as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state">x</slot>
  </component>
  <button v-else-if="shown" v-bind="elementProps()" :ref="setElement">
    <slot :state="state">x</slot>
  </button>
</template>
