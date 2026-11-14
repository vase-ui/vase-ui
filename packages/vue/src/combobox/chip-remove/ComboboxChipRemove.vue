<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';

export interface ComboboxChipRemoveState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface ComboboxChipRemoveProps
  extends
    NativeButtonProps,
    VaseUIComponentProps<ComboboxChipRemoveState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<ButtonHTMLAttributes>, 'disabled'> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed, toRaw } from 'vue';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { findItemIndex } from '../../internals/itemEquality';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useRenderElement } from '../../internals/useRenderElement';
import { getHighlightReason } from '../../utils/getHighlightReason';
import { stopEvent } from '../../utils/popups/event';
import { useComboboxChipContext } from '../chip/ComboboxChipContext';
import { useComboboxRootContext } from '../root/ComboboxRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxChipRemoveProps>(), {
  as: 'button',
  disabled: false,
  nativeButton: true,
});

defineSlots<{
  default(props: { state: ComboboxChipRemoveState }): unknown;
  render: ComponentRenderFn<HTMLProps, ComboboxChipRemoveState>;
}>();

const store = useComboboxRootContext();
const { index } = useComboboxChipContext();

const comboboxDisabled = computed(() => store.select('disabled'));
const readOnly = computed(() => store.select('readOnly'));
const isDisabled = computed(() => comboboxDisabled.value || props.disabled);

const { buttonRef, getButtonProps } = useButton({
  native: () => props.nativeButton,
  disabled: () => isDisabled.value || readOnly.value,
  focusableWhenDisabled: true,
});

const state = computed<ComboboxChipRemoveState>(() => ({ disabled: isDisabled.value }));

function clearActiveIndexForRemovedItem(removedItem: any, event: Event) {
  const { activeIndex, isItemEqualToValue } = toRaw(store.state);

  if (activeIndex == null) {
    return;
  }

  // Try current visible list first; if not found, it's filtered out.
  // No need to clear highlight in that case since it can't equal activeIndex.
  const removedIndex = findItemIndex(
    store.context.valuesRef.value,
    removedItem,
    isItemEqualToValue,
  );
  if (removedIndex !== -1 && activeIndex === removedIndex) {
    store.context.setIndices({
      activeIndex: null,
      type: getHighlightReason(event),
      event,
    });
  }
}

function removeChip(event: MouseEvent | KeyboardEvent) {
  const eventDetails = createChangeEventDetails(REASONS.chipRemovePress, event);
  const { selectedValue } = toRaw(store.state);
  const removedItem = selectedValue[index.value];

  clearActiveIndexForRemovedItem(removedItem, event);

  store.context.setSelectedValue(
    selectedValue.filter((_: any, i: number) => i !== index.value),
    eventDetails,
  );

  store.context.inputRef.value?.focus();
  return eventDetails;
}

const { element, elementProps } = useRenderElement('button', props, {
  state,
  ref: [buttonRef],
  props: (attrs) => [
    {
      tabindex: -1,
      onMousedown(event: MouseEvent) {
        event.preventDefault();
      },
      onClick(event: MouseEvent) {
        const eventDetails = removeChip(event);
        if (!eventDetails.isPropagationAllowed) {
          event.stopPropagation();
        }
      },
      onKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
          const eventDetails = removeChip(event);
          if (!eventDetails.isPropagationAllowed) {
            stopEvent(event);
          }
        }
      },
    },
    attrs,
    getButtonProps,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
