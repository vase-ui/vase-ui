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
  checked?: boolean | undefined;
  /**
   * Whether the checkbox item is initially ticked.
   *
   * To render a controlled checkbox item, use the `checked` prop instead.
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
import { computed, provide } from 'vue';
import { NOOP } from '../../common/empty';
import { useControlled } from '../../common/useControlled';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { REGULAR_ITEM, useMenuItem } from '../item/useMenuItem';
import { useMenuRootContext } from '../root/MenuRootContext';
import { itemMapping } from '../utils/stateAttributesMapping';
import { MenuCheckboxItemContext } from './MenuCheckboxItemContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuCheckboxItemProps>(), {
  as: 'div',
  checked: undefined,
  defaultChecked: false,
  nativeButton: false,
  disabled: false,
  closeOnClick: false,
});

const emit = defineEmits<{
  /**
   * Event handler called when the checkbox item is ticked or unticked.
   */
  checkedChange: [checked: boolean, eventDetails: MenuCheckboxItemChangeEventDetails];
  'update:checked': [checked: boolean];
}>();

defineSlots<{
  default(props: { state: MenuCheckboxItemState }): unknown;
  render: ComponentRenderFn<HTMLProps, MenuCheckboxItemState>;
}>();

const [checked, setChecked] = useControlled({
  controlled: () => props.checked,
  default: () => props.defaultChecked,
  name: 'MenuCheckboxItem',
  state: 'checked',
});

const { store } = useMenuRootContext();

const listItem = useCompositeListItem({ label: () => props.label });
const itemId = useVaseUiId(() => props.id);

const highlighted = computed(() => store.select('isActive', listItem.index.value));
const disabled = computed(() => props.disabled || store.select('disabled'));

const { getItemProps, itemRef } = useMenuItem({
  closeOnClick: () => props.closeOnClick,
  disabled,
  highlighted,
  id: itemId,
  store,
  nativeButton: () => props.nativeButton,
  itemMetadata: REGULAR_ITEM,
});

const state = computed<MenuCheckboxItemState>(() => ({
  disabled: disabled.value,
  highlighted: highlighted.value,
  checked: checked.value,
}));

provide(MenuCheckboxItemContext, state);

function handleClick(event: MouseEvent) {
  const nextChecked = !checked.value;
  const details = createChangeEventDetails(REASONS.itemPress, event, undefined, {
    preventUnmountOnClose: NOOP,
  });

  emit('checkedChange', nextChecked, details);
  if (details.isCanceled) {
    return;
  }

  emit('update:checked', nextChecked);
  setChecked(nextChecked);
}

const { element, elementProps } = useRenderElement('div', props, {
  state,
  stateAttributesMapping: itemMapping,
  ref: [itemRef, listItem.ref],
  props: (attrs) => [
    store.select('itemProps'),
    {
      role: 'menuitemcheckbox',
      'aria-checked': checked.value,
      onClick: handleClick,
    },
    attrs,
    getItemProps,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
