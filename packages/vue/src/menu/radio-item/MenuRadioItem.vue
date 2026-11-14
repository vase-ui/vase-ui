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
import { computed, provide } from 'vue';
import { NOOP } from '../../common/empty';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { REGULAR_ITEM, useMenuItem } from '../item/useMenuItem';
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

const listItem = useCompositeListItem({ label: () => props.label });
// A filterable menu hides the element of an item that the query filters out.
const filterItem = useMenuFilterItem({ label: () => props.label });
const itemId = useVaseUiId(() => props.id);

const highlighted = computed(() => store.select('isActive', listItem.index.value));
const disabled = computed(() => props.disabled || groupDisabled.value || store.select('disabled'));
const checked = computed(() => selectedValue.value === props.value);

const { getItemProps, itemRef } = useMenuItem({
  closeOnClick: () => props.closeOnClick,
  disabled,
  highlighted,
  id: itemId,
  store,
  nativeButton: () => props.nativeButton,
  itemMetadata: REGULAR_ITEM,
});

const state = computed<MenuRadioItemState>(() => ({
  disabled: disabled.value,
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

const { element, elementProps } = useRenderElement('div', props, {
  state,
  stateAttributesMapping: itemMapping,
  ref: [itemRef, listItem.ref, filterItem.ref],
  props: (attrs) => [
    store.select('itemProps'),
    {
      role: 'menuitemradio',
      'aria-checked': checked.value,
      onClick: handleClick,
    },
    attrs,
    getItemProps,
  ],
});

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <template v-if="filterItem.visible.value">
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
    <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
  </template>
  <component :is="filterItem.HiddenItemText" v-else :set-text="filterItem.setHiddenText"><slot :state="state" /></component>
</template>
