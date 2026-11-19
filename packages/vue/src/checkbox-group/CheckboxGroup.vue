<script setup lang="ts">
import { computed, mergeProps, provide, shallowReactive, useAttrs, watch } from 'vue';
import type { ChangeEventDetails } from '../common/changeEventDetails';
import { useDeferredServerRender } from '../common/deferredServerRender';
import { useElement } from '../common/element';
import { useModel } from '../common/model';
import { sameValue } from '../common/values';
import { fieldStateAttributes } from '../field/control';
import { useFieldGroup } from '../field/group';
import { useInDisabledFieldset } from '../fieldset/part';
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
// The label and the messages of the field can come after the group.
useDeferredServerRender();
const { element, setElement } = useElement<HTMLDivElement>();
const inDisabledFieldset = useInDisabledFieldset(element);

const firstValue: readonly string[] = [...(props.modelValue ?? props.defaultValue ?? [])];
const { value, setOwn } = useModel<readonly string[]>(
  () => (props.modelValue === undefined ? undefined : (props.modelValue ?? [])),
  firstValue,
);
const checkboxes = shallowReactive<GroupCheckbox[]>([]);
// The selection that a press on the parent gives back: the value after the last press on a
// child, or the first value.
let selection = firstValue;
// The last reset that the group followed. Each checkbox of the group tells the group a reset.
let lastReset: Event | undefined;

const childValues = computed(() => props.allValues ?? []);
const inputs = computed(() => checkboxes.map((checkbox) => checkbox.element));
const { field, labelledBy, onFocusout } = useFieldGroup({
  element,
  disabled: () => isDisabled.value,
  ownDisabled: () => props.disabled || inDisabledFieldset.value,
  readOnly: () => false,
  inputs: () => inputs.value,
  // A form gets the values of the checked checkboxes that are mounted and enabled.
  formValue: () =>
    value.value.filter((v: string) =>
      checkboxes.some((checkbox) => checkbox.value === v && !checkbox.disabled),
    ),
});
const isDisabled = computed<boolean>(
  () => props.disabled || !!field?.disabled || inDisabledFieldset.value,
);
const state = computed<CheckboxGroupState>(() => ({
  disabled: isDisabled.value,
  touched: field?.state.touched ?? false,
  dirty: field?.state.dirty ?? false,
  valid: field?.state.valid ?? null,
  filled: field?.state.filled ?? false,
}));
const parentChecked = computed(
  () => childValues.value.length > 0 && childValues.value.every((v) => value.value.includes(v)),
);

watch(value, (next) => field?.setValue([...next], next.length > 0), {
  deep: true,
  immediate: true,
});

provide(checkboxGroupKey, {
  get value() {
    return value.value;
  },
  get disabled() {
    return isDisabled.value;
  },
  get hasAllValues() {
    return props.allValues !== undefined;
  },
  parent: {
    get checked() {
      return parentChecked.value;
    },
    get indeterminate() {
      return !parentChecked.value && childValues.value.some((v) => value.value.includes(v));
    },
    get controls() {
      const ids = childValues.value.flatMap((v) =>
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

defineExpose({ element });

function elementProps() {
  return mergeProps(
    {
      role: 'group',
      'aria-labelledby': labelledBy(attrs),
      'aria-describedby': field?.describedBy,
      ...fieldStateAttributes(state.value, isDisabled.value),
      onFocusout,
    },
    attrs,
  );
}

function nextOfParent() {
  const current: readonly string[] = value.value;
  // A disabled child keeps its state.
  const keeps = (v: string) =>
    checkboxes.some((checkbox) => checkbox.value === v && checkbox.disabled);
  const all = (v: string) => current.includes(v) || !keeps(v);
  const none = (v: string) => current.includes(v) && keeps(v);
  const given = (v: string) => (keeps(v) ? current.includes(v) : selection.includes(v));
  const matches = (include: (v: string) => boolean) =>
    childValues.value.every((v) => include(v) === current.includes(v));
  const partial =
    childValues.value.some((v) => selection.includes(v)) &&
    !childValues.value.every((v) => selection.includes(v));
  // A selection that changes nothing does not count.
  const include = matches(all) ? none : matches(none) && partial && !matches(given) ? given : all;
  // A value that is not in `allValues` stays.
  const next = [
    ...current.filter((v) => !childValues.value.includes(v) || include(v)),
    ...childValues.value.filter((v) => include(v) && !current.includes(v)),
  ];
  return { value: next, checked: childValues.value.every((v) => next.includes(v)) };
}

function change(next: string[], details: ChangeEventDetails<'none'>, byChild: boolean) {
  emit('valueChange', next, details);
  if (details.isCanceled) return false;
  if (byChild) selection = next;
  setOwn(next);
  emit('update:modelValue', next);
  return true;
}

function onReset(event: Event) {
  if (event === lastReset) return;
  lastReset = event;
  selection = firstValue;
  field?.onReset([...firstValue]);
  if (sameValue(value.value, firstValue)) return;
  setOwn(firstValue);
  emit('update:modelValue', [...firstValue]);
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
