<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  NonNativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';

export interface MenuRadioItemState {
  /**
   * Whether the radio item should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the radio item is currently highlighted.
   */
  highlighted: boolean;
  /**
   * Whether the radio item is currently selected.
   */
  checked: boolean;
}

export interface MenuRadioItemProps
  extends
    NonNativeButtonProps,
    VaseUIComponentProps<MenuRadioItemState>,
    /* @vue-ignore */ WithVaseUIEvent<Omit<HTMLAttributes, 'id'>> {
  /**
   * Value of the radio item.
   * This is the value that will be set in the MenuRadioGroup when the item is selected.
   */
  value: any;
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
</script>

<script setup lang="ts">
import { computed, provide, shallowRef, type ShallowRef } from 'vue';
import { NOOP } from '../../common/empty';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeList';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { useMenuItem } from '../item/useMenuItem';
import { useMenuRadioGroupContext } from '../radio-group/MenuRadioGroupContext';
import { useMenuFilterItem } from '../filter-root/MenuFilterContext';
import { useMenuRootContext } from '../root/MenuRootContext';
import { itemMapping } from '../utils/stateAttributesMapping';
import { MenuRadioItemContext } from './MenuRadioItemContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuRadioItemProps>(), {
  as: 'div',
  nativeButton: false,
  disabled: false,
  closeOnClick: false,
});

defineSlots<{
  default(props: { state: MenuRadioItemState }): unknown;
  render: ComponentRenderFn<HTMLProps, MenuRadioItemState>;
}>();

const { store } = useMenuRootContext();
const {
  value: selectedValue,
  setValue: setSelectedValue,
  disabled: groupDisabled,
} = useMenuRadioGroupContext();

// A filterable menu removes the element of an item that the query hides. The template then gives
// the content of the item to a component that reads its text and adds no element to the document.
const filterItem = useMenuFilterItem({ label: () => props.label });
const itemId = useVaseUiId(() => props.id);

const element: ShallowRef<HTMLElement | null> = shallowRef(null);
const listIndex = useCompositeListItem(element, { label: () => props.label });

const highlighted = computed(() => store.select('isActive', listIndex.value));
const isDisabled = computed(
  () => props.disabled || groupDisabled.value || store.select('disabled'),
);
const checked = computed(() => selectedValue.value === props.value);

const { button, commonProps } = useMenuItem(element, {
  closeOnClick: () => props.closeOnClick,
  disabled: isDisabled,
  highlighted,
  id: itemId,
  store,
  nativeButton: () => props.nativeButton,
});

const state = computed<MenuRadioItemState>(() => ({
  disabled: isDisabled.value,
  highlighted: highlighted.value,
  checked: checked.value,
}));

provide(MenuRadioItemContext, state);

function handleClick(event: MouseEvent) {
  const details = createChangeEventDetails(REASONS.itemPress, event, undefined, {
    preventUnmountOnClose: NOOP,
  });

  setSelectedValue(props.value, details);
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
      role: 'menuitemradio',
      'aria-checked': checked.value,
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
