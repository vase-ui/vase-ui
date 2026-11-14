<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { MenuRootChangeEventDetails, MenuRootChangeEventReason } from '../root/MenuRoot.vue';

export interface MenuRadioGroupState {
  /**
   * Whether the component is disabled.
   */
  disabled: boolean;
}

export interface MenuRadioGroupProps
  extends
    VaseUIComponentProps<MenuRadioGroupState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * The controlled value of the radio item that should be currently selected.
   *
   * To render an uncontrolled radio group, use the `defaultValue` prop instead.
   */
  value?: any;
  /**
   * The uncontrolled value of the radio item that should be initially selected.
   *
   * To render a controlled radio group, use the `value` prop instead.
   */
  defaultValue?: any;
  /**
   * Whether the component should ignore user interaction.
   *
   * @default false
   */
  disabled?: boolean | undefined;
}

export type MenuRadioGroupChangeEventReason = MenuRootChangeEventReason;
export type MenuRadioGroupChangeEventDetails = MenuRootChangeEventDetails;
</script>

<script setup lang="ts">
import { computed, provide } from 'vue';
import { useControlled } from '../../common/useControlled';
import { createIdRegistry } from '../../internals/labelable-provider/createIdRegistry';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useMenuFilterImpl } from '../filter-root/MenuFilterContext';
import { MenuGroupContext } from '../group/MenuGroupContext';
import { MenuRadioGroupContext } from './MenuRadioGroupContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuRadioGroupProps>(), {
  as: 'div',
  value: undefined,
  disabled: false,
});

const emit = defineEmits<{
  /**
   * Function called when the selected value changes.
   */
  valueChange: [value: any, eventDetails: MenuRadioGroupChangeEventDetails];
  'update:value': [value: any];
}>();

defineSlots<{
  default(props: { state: MenuRadioGroupState }): unknown;
  render: ComponentRenderFn<HTMLProps, MenuRadioGroupState>;
}>();

const [checkedValue, setValueUnwrapped] = useControlled({
  controlled: () => props.value,
  default: () => props.defaultValue,
  name: 'MenuRadioGroup',
});

function setValue(newValue: any, eventDetails: MenuRadioGroupChangeEventDetails) {
  emit('valueChange', newValue, eventDetails);

  if (eventDetails.isCanceled) {
    return;
  }

  emit('update:value', newValue);
  setValueUnwrapped(newValue);
}

const isDisabled = computed(() => props.disabled);

// Each label registers by source, so a label that unmounts does not clear the id of a newer one.
const labelIds = createIdRegistry();
provide(MenuGroupContext, labelIds.registerId);
provide(MenuRadioGroupContext, { value: checkedValue, setValue, disabled: isDisabled });

// A filterable menu hides the group, label included, once the query filters out all of its items.
const filterGroup = useMenuFilterImpl()?.useGroup();

const state = computed<MenuRadioGroupState>(() => ({ disabled: props.disabled }));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => {
    const { 'aria-labelledby': ariaLabelledBy, ...elementAttrs } = attrs;
    return [
      {
        role: 'group',
        'aria-labelledby': ariaLabelledBy ?? labelIds.ids.value.at(-1),
        'aria-disabled': props.disabled || undefined,
      },
      elementAttrs,
      filterGroup?.hiddenProps.value,
    ];
  },
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
