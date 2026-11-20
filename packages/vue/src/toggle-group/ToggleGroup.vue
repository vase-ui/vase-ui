<script setup lang="ts" generic="Value extends string = any">
// vue-tsc resolves `Value` before it checks a listener of a template. With the default `any`, that
// check accepts `(value: ('a' | 'b')[]) => void`.
import { computed, mergeProps, provide, shallowReactive, shallowRef, useAttrs } from 'vue';
import { byDocumentOrder, useElement } from '../common/element';
import { useModel } from '../common/model';
import { useInDisabledFieldset } from '../fieldset/part';
import { useToolbarGroupContext } from '../toolbar/group/ToolbarGroupContext';
import { useToolbarRootContext } from '../toolbar/root/ToolbarRootContext';
import { toggleGroupKey, type GroupToggle } from './toggle';
import type { ToggleGroupChangeEventDetails, ToggleGroupProps, ToggleGroupState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToggleGroupProps<Value>>(), {
  modelValue: undefined,
  defaultValue: undefined,
  multiple: false,
  disabled: false,
  orientation: 'horizontal',
  loopFocus: true,
});
const emit = defineEmits<{
  /** The user presses a toggle. `details.cancel()` keeps the value as it was. */
  valueChange: [value: Value[], details: ToggleGroupChangeEventDetails];
  /** Comes after the change event with the new value, unless a listener cancels the change. `v-model` uses it. */
  'update:modelValue': [value: Value[]];
}>();
defineSlots<{
  default?(scope: { state: ToggleGroupState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ToggleGroupState;
  }): unknown;
}>();

// The Toolbar family replaces the toolbar lines of this file with the item contract of its toolbar.
// Until then, a toolbar holds the tab stop and the keys of the toggles.
const toolbar = useToolbarRootContext(true);
const toolbarGroup = useToolbarGroupContext();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const inDisabledFieldset = useInDisabledFieldset(element);

// `null` is an empty value, and the group stays controlled.
const model = () => (props.modelValue === undefined ? undefined : (props.modelValue ?? []));
const { value, setOwn } = useModel<readonly Value[]>(model, model() ?? props.defaultValue ?? []);
const toggles = shallowReactive<GroupToggle[]>([]);
const focused = shallowRef<GroupToggle>();

const disabledForToggles = computed(
  () => props.disabled || !!toolbar?.disabled.value || !!toolbarGroup?.disabled.value,
);
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

type Step = 'first' | 'last' | 'next' | 'previous' | 'right' | 'left';

const steps: Record<string, Record<string, Step>> = {
  horizontal: { Home: 'first', End: 'last', ArrowRight: 'right', ArrowLeft: 'left' },
  vertical: { Home: 'first', End: 'last', ArrowDown: 'next', ArrowUp: 'previous' },
};

function onKeydown(event: KeyboardEvent) {
  const step = steps[props.orientation]?.[event.key];
  const current = toggles.find((toggle) => toggle.element === event.target);
  if (!step || !current || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
  event.preventDefault();
  const enabled = enabledToggles();
  let next: GroupToggle | undefined;
  if (step === 'first') next = enabled[0];
  else if (step === 'last') next = enabled.at(-1);
  else {
    const rtl = getComputedStyle(event.currentTarget as Element).direction === 'rtl';
    const forward = step === 'next' || step === (rtl ? 'left' : 'right');
    // A focused toggle can be disabled, and the keys still move on from it.
    const choices = current.disabled
      ? [...enabled, current].sort((a, b) => byDocumentOrder(a.element, b.element))
      : enabled;
    const index = choices.indexOf(current) + (forward ? 1 : -1);
    // `at(-1)` is the last toggle.
    next = props.loopFocus ? choices.at(index % choices.length) : choices[index];
  }
  next?.element.focus();
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
