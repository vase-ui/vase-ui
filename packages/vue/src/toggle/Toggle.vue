<script setup lang="ts">
import { computed, inject, useAttrs, useId, watch, watchPostEffect } from 'vue';
import { useButton } from '../common/button';
import { createChangeEventDetails } from '../common/changeEventDetails';
import { useAsTag, useElement, type ElementSlotProps } from '../common/element';
import { error } from '../common/error';
import { useModel } from '../common/model';
import { toggleGroupKey } from '../toggle-group/toggle';
import { toolbarKey, useToolbarItem } from '../toolbar/item';
import type { ToggleEmits, ToggleProps, ToggleState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToggleProps>(), {
  modelValue: undefined,
  defaultPressed: false,
  disabled: false,
  focusableWhenDisabled: false,
});
const emit = defineEmits<ToggleEmits>();
defineSlots<{
  default?(scope: { state: ToggleState }): unknown;
  element?(scope: ElementSlotProps<ToggleState>): unknown;
}>();

const group = inject(toggleGroupKey, null);
const toolbar = inject(toolbarKey, null);
const attrs = useAttrs();
const generatedValue = useId();
const { element, setElement } = useElement<HTMLElement>();
const {
  disabled: isDisabled,
  focusable,
  mergeAttributes,
} = useButton({
  element,
  disabled: () => props.disabled || !!group?.disabled,
  focusableWhenDisabled: () => props.focusableWhenDisabled,
  type: 'button',
  tag: useAsTag(() => props.as, 'button'),
});

const { value: ownPressed, setOwn } = useModel(
  () => props.modelValue,
  props.modelValue ?? props.defaultPressed,
);
// A toggle with no value still takes its own place in the value of its group.
const itemValue = computed(() => props.value || generatedValue);
const pressed = computed(() => (group ? group.value.includes(itemValue.value) : ownPressed.value));
const state = computed<ToggleState>(() => ({ pressed: pressed.value, disabled: isDisabled.value }));

// A toggle of a group in a toolbar is an item of the toolbar. A toggle with no group is an item
// only through `Toolbar.Button`.
const toolbarTabindex =
  group && toolbar
    ? useToolbarItem(toolbar, element, {
        disabled: () => isDisabled.value,
        focusable: () => focusable.value,
      })
    : undefined;

if (group) {
  watch(
    element,
    (el, _, onCleanup) => {
      if (!el) return;
      onCleanup(
        group.addToggle({
          get value() {
            return itemValue.value;
          },
          element: el,
          get disabled() {
            return isDisabled.value;
          },
          get focusable() {
            return focusable.value;
          },
        }),
      );
    },
    { flush: 'post' },
  );
  if (process.env.NODE_ENV !== 'production') {
    watchPostEffect(() => {
      if (props.value === undefined && group.hasValue) {
        error(
          'A `<Toggle>` component rendered in a `<ToggleGroup>` has no explicit `value` prop.',
          'This will cause issues between the Toggle Group and Toggle values.',
          'Give `<Toggle>` a `value` of the same type as an item in the `<ToggleGroup>` model.',
        );
      }
    });
  }
}

defineExpose({ element });

function elementProps() {
  const own: Record<string, unknown> = {
    'aria-pressed': pressed.value ? 'true' : 'false',
    onClick,
  };
  const tabStop = group?.tabStop;
  if (tabStop) own.tabindex = tabStop.element === element.value ? 0 : -1;
  if (toolbarTabindex?.value !== undefined) own.tabindex = toolbarTabindex.value;
  return mergeAttributes(own, attrs);
}

function onClick(event: MouseEvent) {
  const next = !pressed.value;
  const details = createChangeEventDetails('none', event);
  emit('pressedChange', next, details);
  if (details.isCanceled || (group && !group.press(itemValue.value, next, details))) return;
  setOwn(next);
  emit('update:modelValue', next);
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
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <button v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </button>
</template>
