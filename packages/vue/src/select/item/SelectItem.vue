<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  NonNativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';

export interface SelectItemState {
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

export interface SelectItemProps
  extends
    NonNativeButtonProps,
    VaseUIComponentProps<SelectItemState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes>, 'id'> {
  /**
   * A unique value that identifies this select item.
   * @default null
   */
  value?: any;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Specifies the text label to use when the item is matched during keyboard text navigation.
   *
   * Defaults to the item text content if not provided.
   */
  label?: string | undefined;
}
</script>

<script setup lang="ts">
import { computed, onMounted, provide, shallowRef, toRaw, watch } from 'vue';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import {
  compareItemEquality,
  removeItem,
  resolveSelectedIndex,
} from '../../internals/itemEquality';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps, VaseUIEvent } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useRenderElement } from '../../internals/useRenderElement';
import { isVirtualClick } from '../../utils/popups/event';
import { useSelectRootContext } from '../root/SelectRootContext';
import { SelectItemContext } from './SelectItemContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectItemProps>(), {
  as: 'div',
  value: null,
  disabled: false,
  nativeButton: false,
});

defineSlots<{
  default(props: { state: SelectItemState }): unknown;
  render: ComponentRenderFn<HTMLProps, SelectItemState>;
}>();

const store = useSelectRootContext();

const textRef = shallowRef<HTMLElement | null>(null);
const listItem = useCompositeListItem({ label: () => props.label, textRef });
const index = listItem.index;

const itemRoot = computed(() => store.select('itemRoot'));
const isDisabled = computed(() => itemRoot.value.disabled || props.disabled);
const highlighted = computed(() => store.select('isActive', index.value));
const activeWhileOpen = computed(() => store.select('isActiveWhileOpen', index.value));
const selected = computed(() => store.select('isSelected', props.value));
const selectedByFocus = computed(() => store.select('isSelectedByFocus', index.value));

let itemElement: HTMLElement | null = null;

// The positioner reads the value of each item from its element when the list changes. The list can
// change before the `onMounted` hook of a new item runs, so the value goes in with the element.
function setItemElement(node: HTMLElement | null) {
  itemElement = node;
  if (node) {
    store.context.itemValues.set(node, props.value);
  }
}

function syncValue() {
  const currentIndex = index.value;
  if (currentIndex < 0) {
    return;
  }

  store.context.valuesRef.value[currentIndex] = props.value;
}

// The root reads the values in a watcher that runs after the DOM update, and that watcher can run
// before the post watchers of the items. An item thus writes a changed value before the update.
watch(
  () => props.value,
  (value) => {
    if (itemElement) {
      store.context.itemValues.set(itemElement, value);
    }
    syncValue();
  },
);

function claimSelectedIndex() {
  const currentIndex = index.value;
  const itemValue = props.value;
  const { multiple, isItemEqualToValue } = itemRoot.value;
  const { selectedValue, selectedIndex } = toRaw(store.state);

  let nextIndex = selectedIndex;
  let claims: boolean;
  if (multiple && Array.isArray(selectedValue)) {
    // The claiming item also owns the text ref that aligns the popup.
    nextIndex = resolveSelectedIndex(
      currentIndex,
      itemValue,
      store.context.valuesRef.value,
      selectedValue,
      isItemEqualToValue,
      selectedIndex,
    );
    claims = nextIndex === currentIndex;
    if (currentIndex === selectedIndex && !claims) {
      store.context.selectedItemTextRef.value = null;
    }
  } else {
    claims =
      selectedValue !== undefined &&
      compareItemEquality(itemValue, selectedValue, isItemEqualToValue);
    if (claims) {
      nextIndex = currentIndex;
    }
  }
  store.set('selectedIndex', nextIndex);

  // Make sure SelectPopup can measure the selected item on first open.
  // SelectItemText can still update this ref later when focus moves.
  if (claims && textRef.value) {
    store.context.selectedItemTextRef.value = textRef.value;
  }
}

function syncItem() {
  syncValue();
  claimSelectedIndex();
}

onMounted(syncItem);
watch(
  [
    index,
    () => props.value,
    () => itemRoot.value.multiple,
    () => itemRoot.value.isItemEqualToValue,
  ],
  syncItem,
  { flush: 'post' },
);

let pointerType: string = 'mouse';
let allowMouseSelection = false;

const { getButtonProps, buttonRef } = useButton({
  disabled: isDisabled,
  focusableWhenDisabled: true,
  native: () => props.nativeButton,
  composite: true,
});

const state = computed<SelectItemState>(() => ({
  disabled: isDisabled.value,
  selected: selected.value,
  highlighted: highlighted.value,
}));

function commitSelection(event: MouseEvent) {
  const { multiple, disabled, readOnly, isItemEqualToValue } = itemRoot.value;
  // A forced-open select (`open`/`defaultOpen`) can still receive item activations even
  // when the root is disabled or read-only, so guard the commit here too.
  if (disabled || readOnly) {
    return;
  }

  const { selectedValue } = toRaw(store.state);
  if (multiple) {
    const currentValue = Array.isArray(selectedValue) ? selectedValue : [];
    const nextValue = selected.value
      ? removeItem(currentValue, props.value, isItemEqualToValue)
      : [...currentValue, props.value];
    store.context.setValue(nextValue, createChangeEventDetails(REASONS.itemPress, event));
  } else {
    store.context.setValue(props.value, createChangeEventDetails(REASONS.itemPress, event));
    store.setOpen(false, createChangeEventDetails(REASONS.itemPress, event));
  }
}

function resetDragMovement() {
  store.context.selectionRef.value.dragY = 0;
}

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [setItemElement, buttonRef, listItem.ref],
  props: (attrs) => [
    itemRoot.value.props,
    {
      role: 'option',
      'aria-selected': selected.value,
      tabindex: activeWhileOpen.value ? 0 : -1,
      onKeydown(event: VaseUIEvent<KeyboardEvent>) {
        store.set('activeIndex', index.value);

        if (event.key === ' ' && store.context.typingRef.value) {
          // `useButton` skips Space activation for `role="option"` items when the keydown
          // is `defaultPrevented`, keeping typeahead spaces from committing a selection.
          event.preventDefault();
        }
      },
      onClick(event: MouseEvent) {
        const isMouseClick = pointerType !== 'touch';
        const clickPointerType = (event as PointerEvent).pointerType;
        const isVirtualMouseClick =
          isMouseClick &&
          isVirtualClick(event) &&
          // Generic no-pointer `detail === 0` clicks stay tied to highlight state. Virtual
          // clicks that carry browser pointer data, including an empty string from assistive
          // technology, can activate unhighlighted items.
          (clickPointerType !== undefined || highlighted.value);
        // With alignItemWithTrigger, opening can place an item under the cursor. Real mouse
        // clicks must start on the item, while virtual clicks represent explicit keyboard or
        // assistive technology activation.
        const isInvalidMouseClick = isMouseClick && !isVirtualMouseClick && !allowMouseSelection;

        allowMouseSelection = false;

        if (isDisabled.value || isInvalidMouseClick) {
          return;
        }

        commitSelection(event);
      },
      onPointerenter(event: PointerEvent) {
        pointerType = event.pointerType;
      },
      onPointermove(event: PointerEvent) {
        if (event.pointerType === 'mouse' && event.buttons === 1) {
          const selection = store.context.selectionRef.value;
          selection.dragY += event.movementY;

          if (selection.dragY ** 2 >= 64) {
            selection.allowUnselectedMouseUp = true;
          }
        }
      },
      onPointerdown(event: PointerEvent) {
        pointerType = event.pointerType;
        allowMouseSelection = true;
        resetDragMovement();
      },
      onMouseup() {
        resetDragMovement();

        if (isDisabled.value || pointerType === 'touch') {
          return;
        }

        // Regular clicks are committed by the click event.
        if (allowMouseSelection) {
          return;
        }

        const selection = store.context.selectionRef.value;
        const disallowSelectedMouseUp = !selection.allowSelectedMouseUp && selected.value;
        const disallowUnselectedMouseUp = !selection.allowUnselectedMouseUp && !selected.value;

        if (disallowSelectedMouseUp || disallowUnselectedMouseUp) {
          return;
        }

        allowMouseSelection = true;
        // Drag selection has no mousedown on the item. Focus it before the synthetic click so
        // arrow-key navigation continues from the selected item.
        element.value?.focus({ preventScroll: true });
        element.value?.click();
        allowMouseSelection = false;
      },
    },
    attrs,
    getButtonProps,
  ],
});

provide(SelectItemContext, { selected, index, textRef, selectedByFocus });

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
