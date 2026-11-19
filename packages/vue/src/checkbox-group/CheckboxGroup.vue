<script setup lang="ts">
import {
  computed,
  inject,
  mergeProps,
  provide,
  shallowReactive,
  shallowRef,
  useAttrs,
  watch,
} from 'vue';
import type { ChangeEventDetails } from '../common/changeEventDetails';
import { useElement } from '../common/element';
import { sameValue } from '../common/values';
import { fieldKey, fieldStateAttributes } from '../field/control';
import { fieldsetKey, useInDisabledFieldset } from '../fieldset/part';
import { checkboxGroupKey, type GroupCheckbox } from './checkbox';
import type {
  CheckboxGroupChangeEventDetails,
  CheckboxGroupProps,
  CheckboxGroupState,
} from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CheckboxGroupProps>(), {
  modelValue: undefined,
  defaultValue: undefined,
  allValues: undefined,
});
const emit = defineEmits<{
  valueChange: [value: string[], details: CheckboxGroupChangeEventDetails];
  'update:modelValue': [value: string[]];
}>();
defineSlots<{
  default?(scope: { state: CheckboxGroupState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: CheckboxGroupState;
  }): unknown;
}>();

const attrs = useAttrs();
const field = inject(fieldKey, null);
const fieldset = inject(fieldsetKey, null);
const { element, setElement } = useElement<HTMLDivElement>();
const inDisabledFieldset = useInDisabledFieldset(element);

const firstValue: readonly string[] = [...(props.modelValue ?? props.defaultValue ?? [])];
// The value while no `modelValue` controls it: the last value, controlled or not.
const ownValue = shallowRef<readonly string[]>(firstValue);
const value = computed<readonly string[]>(() =>
  props.modelValue === undefined ? ownValue.value : (props.modelValue ?? []),
);
const checkboxes = shallowReactive<GroupCheckbox[]>([]);
// The selection that a press on the parent gives back: the value after the last press on a
// child, or the first value.
let selection = firstValue;
// The last reset that the group followed. Each checkbox of the group tells the group a reset.
let lastReset: Event | undefined;

const allValues = computed(() => props.allValues ?? []);
const disabled = computed(() => props.disabled || !!field?.disabled || inDisabledFieldset.value);
const state = computed<CheckboxGroupState>(() => ({
  disabled: disabled.value,
  touched: field?.state.touched ?? false,
  dirty: field?.state.dirty ?? false,
  valid: field?.state.valid ?? null,
  filled: field?.state.filled ?? false,
}));
const parentChecked = computed(
  () => allValues.value.length > 0 && allValues.value.every((v) => value.value.includes(v)),
);
const inputs = computed(() => checkboxes.map((checkbox) => checkbox.element));

watch(
  value,
  (next) => {
    if (props.modelValue !== undefined) ownValue.value = [...next];
    field?.setValue([...next], next.length > 0);
  },
  { deep: true, immediate: true },
);

watch(
  element,
  (el, _, onCleanup) => {
    if (!el || !field) return;
    onCleanup(
      field.setControl({
        element: el,
        get id() {
          return el.id;
        },
        name: undefined,
        get disabled() {
          return props.disabled || inDisabledFieldset.value;
        },
        readOnly: false,
        get inputs() {
          return inputs.value;
        },
      }),
    );
  },
  { flush: 'post' },
);

provide(checkboxGroupKey, {
  get value() {
    return value.value;
  },
  get disabled() {
    return disabled.value;
  },
  get hasAllValues() {
    return props.allValues !== undefined;
  },
  parent: {
    get checked() {
      return parentChecked.value;
    },
    get indeterminate() {
      return !parentChecked.value && allValues.value.some((v) => value.value.includes(v));
    },
    get controls() {
      const ids = allValues.value.flatMap((v) =>
        checkboxes.filter((checkbox) => checkbox.value === v).map((checkbox) => checkbox.id),
      );
      return ids.join(' ') || undefined;
    },
  },
  nextOfParent,
  change,
  onEdit: () => field?.onEdit(),
  onReset,
  addCheckbox(checkbox) {
    checkboxes.push(checkbox);
    return () => checkboxes.splice(checkboxes.indexOf(checkbox), 1);
  },
});

// The checkboxes of the group show the state of the field. The group is the control of the
// field, so it gives them no part in it.
if (field) {
  provide(fieldKey, {
    get disabled() {
      return disabled.value;
    },
    get name() {
      return field.name;
    },
    controlId: undefined,
    labelId: undefined,
    get describedBy() {
      return field.describedBy;
    },
    get state() {
      return field.state;
    },
    setControl: () => () => {},
    setValue() {},
    onEdit() {},
    onLeave() {},
    onReset() {},
  });
}

defineExpose({ element });

function elementProps() {
  const named = 'aria-label' in attrs || 'aria-labelledby' in attrs;
  return mergeProps(
    {
      role: 'group',
      'aria-labelledby': named ? undefined : (field?.labelId ?? fieldset?.legendId),
      'aria-describedby': field?.describedBy,
      ...fieldStateAttributes(state.value, disabled.value),
      onFocusout,
    },
    attrs,
  );
}

function nextOfParent() {
  const current = value.value;
  // A disabled child keeps its state.
  const keeps = (v: string) =>
    checkboxes.some((checkbox) => checkbox.value === v && checkbox.disabled);
  const all = (v: string) => current.includes(v) || !keeps(v);
  const none = (v: string) => current.includes(v) && keeps(v);
  const given = (v: string) => (keeps(v) ? current.includes(v) : selection.includes(v));
  const matches = (include: (v: string) => boolean) =>
    allValues.value.every((v) => include(v) === current.includes(v));
  const partial =
    allValues.value.some((v) => selection.includes(v)) &&
    !allValues.value.every((v) => selection.includes(v));
  // A selection that changes nothing does not count.
  const include = matches(all) ? none : matches(none) && partial && !matches(given) ? given : all;
  // A value that is not in `allValues` stays.
  const next = [
    ...current.filter((v) => !allValues.value.includes(v) || include(v)),
    ...allValues.value.filter((v) => include(v) && !current.includes(v)),
  ];
  return { value: next, checked: allValues.value.every((v) => next.includes(v)) };
}

function change(next: string[], details: ChangeEventDetails<'none'>, byChild: boolean) {
  emit('valueChange', next, details);
  if (details.isCanceled) return false;
  if (byChild) selection = next;
  ownValue.value = next;
  emit('update:modelValue', next);
  return true;
}

function onReset(event: Event) {
  if (event === lastReset) return;
  lastReset = event;
  selection = firstValue;
  field?.onReset([...firstValue]);
  if (sameValue(value.value, firstValue)) return;
  ownValue.value = firstValue;
  emit('update:modelValue', [...firstValue]);
}

function onFocusout(event: FocusEvent) {
  // A move of the focus between two checkboxes of the group is not a leave.
  if (!element.value?.contains(event.relatedTarget as Node | null)) field?.onLeave();
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
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
