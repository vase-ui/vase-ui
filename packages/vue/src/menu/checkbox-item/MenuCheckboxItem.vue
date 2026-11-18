<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  NonNativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import type { MenuRootChangeEventDetails, MenuRootChangeEventReason } from '../root/MenuRoot.vue';

export interface MenuCheckboxItemState {
  /**
   * Whether the checkbox item should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the checkbox item is currently highlighted.
   */
  highlighted: boolean;
  /**
   * Whether the checkbox item is currently ticked.
   */
  checked: boolean;
}

export interface MenuCheckboxItemProps
  extends
    NonNativeButtonProps,
    VaseUIComponentProps<MenuCheckboxItemState>,
    /* @vue-ignore */ WithVaseUIEvent<Omit<HTMLAttributes, 'id'>> {
  /**
   * Whether the checkbox item is currently ticked.
   *
   * To render an uncontrolled checkbox item, use the `defaultChecked` prop instead.
   */
  modelValue?: boolean | undefined;
  /**
   * Whether the checkbox item is initially ticked.
   *
   * To render a controlled checkbox item, use the `modelValue` prop instead.
   * @default false
   */
  defaultChecked?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Overrides the text used for keyboard text navigation and filtering.
   * Falls back to the rendered text when not provided.
   */
  label?: string | undefined;
  /**
   * @ignore
   */
  id?: string | undefined;
  /**
   * Whether to close the menu when the item is clicked.
   * @default false
   */
  closeOnClick?: boolean | undefined;
}

export type MenuCheckboxItemChangeEventReason = MenuRootChangeEventReason;
export type MenuCheckboxItemChangeEventDetails = MenuRootChangeEventDetails;
</script>

<script setup lang="ts">
import { computed, provide, shallowRef, type ShallowRef } from 'vue';
import { NOOP } from '../../common/empty';
import { useControlled } from '../../common/useControlled';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeList';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../internals/useRenderElement';
import { useMenuItem } from '../item/useMenuItem';
import { useMenuFilterItem } from '../filter-root/MenuFilterContext';
import { useMenuRootContext } from '../root/MenuRootContext';
import { itemMapping } from '../utils/stateAttributesMapping';
import { MenuCheckboxItemContext } from './MenuCheckboxItemContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuCheckboxItemProps>(), {
  as: 'div',
  modelValue: undefined,
  defaultChecked: false,
  nativeButton: false,
  disabled: false,
  closeOnClick: false,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Menu.CheckboxItem');
}

const emit = defineEmits<{
  /**
   * Event handler called when the checkbox item is ticked or unticked.
   */
  checkedChange: [checked: boolean, eventDetails: MenuCheckboxItemChangeEventDetails];
  /**
   * Event handler called after `checkedChange` with the new value, unless a listener cancels the
   * change. `v-model` uses it.
   */
  'update:modelValue': [checked: boolean];
}>();

defineSlots<{
  default(props: { state: MenuCheckboxItemState }): unknown;
  render: ComponentRenderFn<HTMLProps, MenuCheckboxItemState>;
}>();

const isChecked = useControlled({
  controlled: () => props.modelValue,
  default: () => props.defaultChecked,
  name: 'MenuCheckboxItem',
  state: 'checked',
});

const { store } = useMenuRootContext();

// A filterable menu removes the element of an item that the query hides. The template then gives
// the content of the item to a component that reads its text and adds no element to the document.
// The state of the item stays in this part, so a hidden item keeps it.
const filterItem = useMenuFilterItem({ label: () => props.label });
const itemId = useVaseUiId(() => props.id);

const element: ShallowRef<HTMLElement | null> = shallowRef(null);
const listIndex = useCompositeListItem(element, { label: () => props.label });

const highlighted = computed(() => store.select('isActive', listIndex.value));
const isDisabled = computed(() => props.disabled || store.select('disabled'));

const { button, commonProps } = useMenuItem(element, {
  closeOnClick: () => props.closeOnClick,
  disabled: isDisabled,
  highlighted,
  id: itemId,
  store,
  nativeButton: () => props.nativeButton,
});

const state = computed<MenuCheckboxItemState>(() => ({
  disabled: isDisabled.value,
  highlighted: highlighted.value,
  checked: isChecked.value,
}));

provide(MenuCheckboxItemContext, state);

function handleClick(event: MouseEvent) {
  const nextChecked = !isChecked.value;
  const details = createChangeEventDetails(REASONS.itemPress, event, undefined, {
    preventUnmountOnClose: NOOP,
  });

  emit('checkedChange', nextChecked, details);
  if (details.isCanceled) {
    return;
  }

  emit('update:modelValue', nextChecked);
  isChecked.value = nextChecked;
}

const { elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  elementRef: element,
  button,
  state,
  stateAttributesMapping: itemMapping,
  ref: filterItem.ref,
  props: (attrs) => [
    commonProps.value,
    store.select('itemProps'),
    {
      role: 'menuitemcheckbox',
      'aria-checked': isChecked.value,
      onClick: handleClick,
    },
    attrs,
  ],
});

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="filterItem.visible.value && usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else-if="filterItem.visible.value" v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
  <component :is="filterItem.HiddenItemText" v-else :set-text="filterItem.setHiddenText" :label="label">
    <slot v-if="$slots.render" name="render" :props="{} as HTMLProps" :state="state" />
    <slot v-else :state="state" />
  </component>
</template>
