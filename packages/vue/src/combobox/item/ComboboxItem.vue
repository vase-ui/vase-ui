<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  NonNativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';

export interface ComboboxItemState {
  /**
   * Whether the item should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the item is selected.
   */
  selected: boolean;
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
}

export interface ComboboxItemProps
  extends
    NonNativeButtonProps,
    VaseUIComponentProps<ComboboxItemState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes>, 'id'> {
  /**
   * The index of the item in the list. Improves performance when specified by avoiding the need to calculate the index automatically from the DOM.
   */
  index?: number | undefined;
  /**
   * A unique value that identifies this item.
   * @default null
   */
  value?: any;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed, nextTick, provide, shallowRef, toRaw } from 'vue';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import {
  compareItemEquality,
  findItemIndex,
  resolveSelectedIndex,
} from '../../internals/itemEquality';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useRenderElement } from '../../internals/useRenderElement';
import { useDomEffect } from '../../utils/popups/useDomEffect';
import {
  useComboboxDerivedItemsContext,
  useComboboxHasItemsContext,
  useComboboxRootContext,
} from '../root/ComboboxRootContext';
import { useComboboxRowContext } from '../row/ComboboxRowContext';
import { ComboboxItemContext } from './ComboboxItemContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxItemProps>(), {
  as: 'div',
  index: undefined,
  value: null,
  disabled: false,
  nativeButton: false,
});

defineSlots<{
  default(props: { state: ComboboxItemState }): unknown;
  render: ComponentRenderFn<HTMLProps, ComboboxItemState>;
}>();

const textRef = shallowRef<HTMLElement | null>(null);
const listItem = useCompositeListItem({ index: () => props.index, textRef });

const store = useComboboxRootContext();
const isRow = useComboboxRowContext();
const hasItems = useComboboxHasItemsContext();
const { flatFilteredValues } = useComboboxDerivedItemsContext();

const itemRoot = computed(() => store.select('itemRoot'));
const virtualized = computed(() => store.select('virtualized'));

const isDisabled = computed(() => itemRoot.value.disabled || props.disabled);
const selectable = computed(() => itemRoot.value.selectionMode !== 'none');

// A virtualized item with no `index` is in no list registry, so its index comes from the filtered
// values. Only such an item reads them, so a query that keeps the same items renders no other item
// again.
const indexFromFilter = computed(() =>
  virtualized.value && props.index == null
    ? findItemIndex(flatFilteredValues.value, props.value, store.select('isItemEqualToValue'))
    : undefined,
);
const itemIndex = computed(() => props.index ?? indexFromFilter.value ?? listItem.index.value);
const hasRegistered = computed(() => itemIndex.value !== -1);

const highlighted = computed(() => store.select('isActive', itemIndex.value));
const matchesSelectedValue = computed(() => store.select('isSelected', props.value));
const selected = computed(() => matchesSelectedValue.value && selectable.value);

const id = computed(() => {
  const rootId = itemRoot.value.id;
  return rootId != null && hasRegistered.value ? `${rootId}-${itemIndex.value}` : undefined;
});

useDomEffect([hasRegistered, virtualized, itemIndex, () => props.index], () => {
  if (!hasRegistered.value || !(virtualized.value || props.index != null)) {
    return undefined;
  }

  const list = store.context.listRef.value;
  const currentIndex = itemIndex.value;
  list[currentIndex] = element.value;

  return () => {
    delete list[currentIndex];
  };
});

useDomEffect([hasRegistered, hasItems, itemIndex, () => props.value], () => {
  if (!hasRegistered.value || hasItems.value) {
    return undefined;
  }

  const visibleValues = store.context.valuesRef.value;
  const currentIndex = itemIndex.value;
  visibleValues[currentIndex] = props.value;

  return () => {
    delete visibleValues[currentIndex];
  };
});

useDomEffect(
  [hasRegistered, hasItems, itemIndex, () => props.value, () => itemRoot.value.isItemEqualToValue],
  () => {
    if (!hasRegistered.value || hasItems.value) {
      return;
    }

    // Runs while closed as well (the list can stay mounted via `keepMounted` or a
    // force-mount) so the index tracks the item's composite position, keeping features
    // like closed-trigger typeahead in sync when the rendered order changes.
    const { selectedValue, selectionMode, selectedIndex } = toRaw(store.state);
    const { isItemEqualToValue } = itemRoot.value;

    let nextIndex = selectedIndex;
    if (selectionMode === 'multiple' && Array.isArray(selectedValue)) {
      nextIndex = resolveSelectedIndex(
        itemIndex.value,
        props.value,
        store.context.valuesRef.value,
        selectedValue,
        isItemEqualToValue,
        nextIndex,
      );
    } else if (compareItemEquality(props.value, selectedValue, isItemEqualToValue)) {
      nextIndex = itemIndex.value;
    }
    store.set('selectedIndex', nextIndex);
  },
);

const { getButtonProps, buttonRef } = useButton({
  disabled: isDisabled,
  focusableWhenDisabled: true,
  native: () => props.nativeButton,
  composite: true,
});

const state = computed<ComboboxItemState>(() => ({
  disabled: isDisabled.value,
  selected: selected.value,
  highlighted: highlighted.value,
}));

async function commitSelection(event: MouseEvent) {
  store.context.handleSelection(event, props.value);

  if (toRaw(store.state).submitOnItemClick) {
    // The form reads the hidden input, which gets the new value in the next Vue flush.
    await nextTick();
    store.context.requestSubmit();
  }
}

function isInteractive() {
  return !isDisabled.value && !itemRoot.value.readOnly;
}

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [buttonRef, listItem.ref],
  props: (attrs) => [
    itemRoot.value.props,
    {
      id: id.value,
      role: isRow ? 'gridcell' : 'option',
      'aria-selected': selectable.value ? selected.value : undefined,
      // Focusable items steal focus from the input upon mouseup.
      // Warn if the user renders a natively focusable element like `<button>`,
      // as it should be a `<div>` instead.
      tabindex: undefined,
      onPointerdownCapture(event: PointerEvent) {
        // The compat `mouseup` only fires for the primary pointer, so a non-primary
        // touch must not overwrite the shared ref — a mismatch would make the primary
        // pointer's release read as a drag-select and commit a second time after `click`.
        if (event.isPrimary) {
          store.context.pointerDownItemRef.value = event.currentTarget as Element;
        }
        event.preventDefault();
      },
      onMousedown(event: MouseEvent) {
        // iOS Safari can emit a synthetic mousedown for touch taps without a preceding
        // pointerdown. Prevent default here too so tapping an item does not blur the input.
        event.preventDefault();
      },
      onClick(event: MouseEvent) {
        if (isInteractive()) {
          void commitSelection(event);
        }
      },
      onMouseup(event: MouseEvent) {
        const pointerStartedOnItem = store.context.pointerDownItemRef.value === event.currentTarget;
        store.context.pointerDownItemRef.value = null;

        if (!isInteractive() || event.button !== 0 || pointerStartedOnItem || !highlighted.value) {
          return;
        }

        void commitSelection(event);
      },
    },
    attrs,
    getButtonProps,
  ],
});

provide(ComboboxItemContext, { selected, textRef });

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
