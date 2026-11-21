<script setup lang="ts" generic="Value extends string = any">
// vue-tsc resolves `Value` before it checks a listener of a template. With the default `any`, that
// check accepts `(value: ('a' | 'b')[]) => void`.
import { computed, inject, mergeProps, provide, shallowReactive, shallowRef, useAttrs } from 'vue';
import { arrowKeyTarget } from '../common/arrowKeyTarget';
import { byDocumentOrder, useElement, type ElementSlotProps } from '../common/element';
import { useModel } from '../common/model';
import { ownerWindow } from '../common/owner';
import { useInDisabledFieldset } from '../fieldset/part';
import { toolbarKey } from '../toolbar/item';
import { toggleGroupKey, type GroupToggle } from './toggle';
import type {
  ToggleGroupChangeEventDetails,
  ToggleGroupEmits,
  ToggleGroupProps,
  ToggleGroupState,
} from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToggleGroupProps<Value>>(), {
  modelValue: undefined,
  defaultValue: undefined,
  multiple: false,
  disabled: false,
  orientation: 'horizontal',
  loopFocus: true,
});
const emit = defineEmits<ToggleGroupEmits<Value>>();
defineSlots<{
  default?(scope: { state: ToggleGroupState }): unknown;
  element?(scope: ElementSlotProps<ToggleGroupState>): unknown;
}>();

// A toolbar holds the tab stop and the keys of the toggles. Each toggle is an item of the toolbar.
const toolbar = inject(toolbarKey, null);
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const inDisabledFieldset = useInDisabledFieldset(element);

// `null` is an empty value, and the group stays controlled.
const model = () => (props.modelValue === undefined ? undefined : (props.modelValue ?? []));
const { value, setOwn } = useModel<readonly Value[]>(model, model() ?? props.defaultValue ?? []);
const toggles = shallowReactive<GroupToggle[]>([]);
const focused = shallowRef<GroupToggle>();

const disabledForToggles = computed(() => props.disabled || !!toolbar?.disabled);
const state = computed<ToggleGroupState>(() => ({
  disabled: disabledForToggles.value || inDisabledFieldset.value,
  multiple: props.multiple,
  orientation: props.orientation,
}));
const tabStop = computed(() => {
  if (toolbar) return undefined;
  const last = focused.value;
  if (last && !last.disabled) return last;
  return enabledToggles()[0];
});

provide(toggleGroupKey, {
  get value() {
    return value.value;
  },
  get disabled() {
    return disabledForToggles.value;
  },
  get hasValue() {
    return props.modelValue !== undefined || props.defaultValue !== undefined;
  },
  get tabStop() {
    return tabStop.value;
  },
  press,
  addToggle(toggle) {
    toggles.push(toggle);
    return () => {
      toggles.splice(toggles.indexOf(toggle), 1);
      if (focused.value === toggle) focused.value = undefined;
    };
  },
});

defineExpose({ element });

function elementProps() {
  return mergeProps(
    {
      role: 'group',
      'data-orientation': props.orientation,
      'data-disabled': state.value.disabled ? '' : undefined,
      ...(!toolbar && { onKeydown, onFocusin }),
    },
    attrs,
  );
}

function press(toggleValue: string, pressed: boolean, details: ToggleGroupChangeEventDetails) {
  const current = value.value as readonly string[];
  const next = (
    props.multiple
      ? pressed
        ? [...current, toggleValue]
        : current.filter((item) => item !== toggleValue)
      : pressed
        ? [toggleValue]
        : []
  ) as Value[];
  emit('valueChange', next, details);
  if (details.isCanceled) return false;
  setOwn(next);
  emit('update:modelValue', next);
  return true;
}

function enabledToggles() {
  return toggles
    .filter((toggle) => !toggle.disabled)
    .sort((a, b) => byDocumentOrder(a.element, b.element));
}

function onFocusin(event: FocusEvent) {
  const toggle = toggles.find((candidate) => candidate.element === event.target);
  if (toggle) focused.value = toggle;
}

function onKeydown(event: KeyboardEvent) {
  const current = toggles.find((toggle) => toggle.element === event.target);
  if (!current || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
  const enabled = enabledToggles().map((toggle) => toggle.element);
  const group = event.currentTarget as HTMLElement;
  // A focused toggle can be disabled, and the keys still move on from it.
  const next =
    event.key === 'Home'
      ? enabled[0]
      : event.key === 'End'
        ? enabled.at(-1)
        : arrowKeyTarget(event.key, current.element, enabled, {
            orientation: props.orientation,
            rtl: ownerWindow(group).getComputedStyle(group).direction === 'rtl',
            loop: props.loopFocus,
          });
  if (event.key !== 'Home' && event.key !== 'End' && !next) return;
  event.preventDefault();
  next?.focus();
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
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
