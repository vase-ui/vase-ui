<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
import type { REASONS } from '../internals/reasons';
import type { Orientation, VaseUIComponentProps, WithVaseUIEvent } from '../internals/types';

export interface ToggleGroupState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * When `false` only one item in the group can be pressed. If any item in
   * the group becomes pressed, the others will become unpressed.
   * When `true` multiple items can be pressed.
   * @default false
   */
  multiple: boolean;
  /**
   * The orientation of the toggle group.
   */
  orientation: Orientation;
}

export interface ToggleGroupProps<Value extends string = string>
  extends
    VaseUIComponentProps<ToggleGroupState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * The pressed state of the toggle group represented by an array of
   * the values of all pressed toggle buttons.
   * This is the controlled counterpart of `defaultValue`.
   */
  value?: readonly Value[] | undefined;
  /**
   * The pressed state of the toggle group represented by an array of
   * the values of all pressed toggle buttons.
   * This is the uncontrolled counterpart of `value`.
   */
  defaultValue?: readonly Value[] | undefined;
  /**
   * Whether the toggle group should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
  /**
   * Whether to loop keyboard focus back to the first item
   * when the end of the list is reached while using the arrow keys.
   * @default true
   */
  loopFocus?: boolean | undefined;
  /**
   * When `false` only one item in the group can be pressed. If any item in
   * the group becomes pressed, the others will become unpressed.
   * When `true` multiple items can be pressed.
   * @default false
   */
  multiple?: boolean | undefined;
}

export type ToggleGroupChangeEventReason = typeof REASONS.none;

export type ToggleGroupChangeEventDetails = VaseUIChangeEventDetails<ToggleGroupChangeEventReason>;
</script>

<script setup lang="ts" generic="Value extends string = string">
import { computed, provide } from 'vue';
import { EMPTY_ARRAY } from '../common/empty';
import { useControlled } from '../common/useControlled';
import { useCompositeRoot } from '../internals/composite/root/useCompositeRoot';
import type { ComponentRenderFn, HTMLProps } from '../internals/types';
import { useRenderElement } from '../internals/useRenderElement';
import { useToolbarGroupContext } from '../toolbar/group/ToolbarGroupContext';
import { useToolbarRootContext } from '../toolbar/root/ToolbarRootContext';
import { ToggleGroupContext } from './ToggleGroupContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToggleGroupProps<Value>>(), {
  as: 'div',
  value: undefined,
  defaultValue: undefined,
  disabled: false,
  orientation: 'horizontal',
  loopFocus: true,
  multiple: false,
});

const emit = defineEmits<{
  /**
   * Callback fired when the pressed states of the toggle group changes.
   */
  valueChange: [groupValue: Value[], eventDetails: ToggleGroupChangeEventDetails];
  'update:value': [groupValue: Value[]];
}>();

defineSlots<{
  default(props: { state: ToggleGroupState }): unknown;
  render: ComponentRenderFn<HTMLProps, ToggleGroupState>;
}>();

const toolbarContext = useToolbarRootContext(true);
const toolbarGroupContext = useToolbarGroupContext();

const groupDisabled = computed(
  () =>
    (toolbarContext?.disabled.value ?? false) ||
    (toolbarGroupContext?.disabled.value ?? false) ||
    props.disabled,
);

const [groupValue, setValueState] = useControlled<readonly Value[]>({
  controlled: () => props.value,
  default: () => props.defaultValue ?? EMPTY_ARRAY,
  name: 'ToggleGroup',
  state: 'value',
});

function setGroupValue(
  newValue: Value,
  nextPressed: boolean,
  eventDetails: ToggleGroupChangeEventDetails,
) {
  let newGroupValue: Value[];
  if (props.multiple) {
    newGroupValue = groupValue.value.slice();
    if (nextPressed) {
      newGroupValue.push(newValue);
    } else {
      newGroupValue.splice(groupValue.value.indexOf(newValue), 1);
    }
  } else {
    newGroupValue = nextPressed ? [newValue] : [];
  }

  emit('valueChange', newGroupValue, eventDetails);

  if (eventDetails.isCanceled) {
    return;
  }

  emit('update:value', newGroupValue);
  setValueState(newGroupValue);
}

const state = computed<ToggleGroupState>(() => ({
  disabled: groupDisabled.value,
  multiple: props.multiple,
  orientation: props.orientation,
}));

provide(ToggleGroupContext, {
  disabled: groupDisabled,
  setGroupValue,
  value: groupValue,
  // The raw props tell an absent value from the empty default.
  isValueInitialized: computed(() => props.value !== undefined || props.defaultValue !== undefined),
});

// In a toolbar, the root of the toolbar is the composite root, and the toggles are its items.
// A second root here would give the toolbar a second tab stop. The context of a component does
// not change, so `setup` can make this choice one time.
const composite = toolbarContext
  ? undefined
  : useCompositeRoot({
      loopFocus: () => props.loopFocus,
      enableHomeAndEndKeys: true,
      orientation: () => props.orientation,
    });

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: composite ? [composite.rootRef] : [],
  props: (attrs) => [composite?.props, { role: 'group' }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
