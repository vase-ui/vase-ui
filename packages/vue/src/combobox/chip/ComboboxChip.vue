<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface ComboboxChipState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface ComboboxChipProps
  extends
    VaseUIComponentProps<ComboboxChipState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed, nextTick, provide, toRaw } from 'vue';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { stopEvent } from '../../utils/popups/event';
import { useComboboxChipsContext } from '../chips/ComboboxChipsContext';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { getChipNavigationKeys, getIndexAfterChipRemoval } from '../utils/parts';
import { ComboboxChipContext } from './ComboboxChipContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxChipProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ComboboxChipState }): unknown;
  render: ComponentRenderFn<HTMLProps, ComboboxChipState>;
}>();

const store = useComboboxRootContext();
const chipsContext = useComboboxChipsContext();
if (chipsContext === undefined) {
  throw new Error(
    'Vase UI: <Combobox.Chip> must be inside <Combobox.Chips>. Without the chips part the chip cannot find the other chips for the arrow keys. Put the chip inside <Combobox.Chips>.',
  );
}
const { chipsRef } = chipsContext;
const direction = useDirection();

const disabled = computed(() => store.select('disabled'));
const readOnly = computed(() => store.select('readOnly'));

const listItem = useCompositeListItem();

async function handleKeydown(event: KeyboardEvent) {
  if (disabled.value || readOnly.value) {
    return;
  }

  const currentIndex = listItem.index.value;
  const { selectedValue } = toRaw(store.state);
  const [previousChipKey, nextChipKey] = getChipNavigationKeys(direction.value);
  let nextIndex: number | undefined = currentIndex;

  if (event.key === previousChipKey) {
    event.preventDefault();
    nextIndex = currentIndex > 0 ? currentIndex - 1 : undefined;
  } else if (event.key === nextChipKey) {
    event.preventDefault();
    nextIndex = currentIndex < chipsRef.value.length - 1 ? currentIndex + 1 : undefined;
  } else if (event.key === 'Backspace' || event.key === 'Delete') {
    nextIndex = getIndexAfterChipRemoval(currentIndex, selectedValue.length);

    stopEvent(event);

    store.context.setIndices({
      activeIndex: null,
      selectedIndex: null,
      type: REASONS.keyboard,
      event,
    });
    store.context.setSelectedValue(
      selectedValue.filter((_: any, i: number) => i !== currentIndex),
      createChangeEventDetails(REASONS.none, event),
    );
    // The registry of the chips drops the removed chip in the update that this write starts.
    // `chipsRef` then holds the remaining chips.
    await nextTick();
  } else if (event.key === 'Enter' || event.key === ' ') {
    stopEvent(event);
    nextIndex = undefined;
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    stopEvent(event);
    store.setOpen(true, createChangeEventDetails(REASONS.listNavigation, event));
    // The input may mount when the popup opens.
    await nextTick();
    nextIndex = undefined;
  } else if (
    // Check for printable characters (letters, numbers, symbols)
    event.key.length === 1 &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  ) {
    nextIndex = undefined;
  }

  if (nextIndex === undefined) {
    store.context.inputRef.value?.focus();
  } else {
    chipsRef.value[nextIndex]?.focus();
  }
}

const state = computed<ComboboxChipState>(() => ({ disabled: disabled.value }));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [listItem.ref],
  props: (attrs) => [
    {
      tabindex: -1,
      'aria-disabled': disabled.value || undefined,
      'aria-readonly': readOnly.value || undefined,
      onKeydown: handleKeydown,
    },
    attrs,
  ],
});

provide(ComboboxChipContext, { index: listItem.index });

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
