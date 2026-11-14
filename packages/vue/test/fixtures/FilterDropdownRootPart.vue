<script lang="ts">
import type { Ref } from 'vue';
import type {
  FilterDropdownFilter,
  FilterDropdownRootChangeEventDetails,
} from '../../src/filter-dropdown/root/FilterDropdownRootContext';

export interface FilterDropdownRootPartProps {
  /** Whether the popup is open. */
  open: boolean;
  /** Whether the filter controls ignore user interaction. */
  disabled?: boolean | undefined;
  /** Whether the popup opened from the keyboard. */
  openedByKeyboard?: boolean | undefined;
  /** The locale of the default filter. */
  locale?: Intl.LocalesArgument | undefined;
  /** The value of the filter input. */
  value: string;
  /** The query of the filter when it differs from the value of the input. */
  query?: string | undefined;
  /** The filter of the items. `null` turns the filter off. */
  filter?: FilterDropdownFilter | null | undefined;
  /** Whether the first matching item gets the highlight. */
  autoHighlight?: boolean | 'always' | undefined;
  /** The id of a trigger outside the root. */
  triggerId?: string | null | undefined;
  /** The item elements of the host, in the order of the document. */
  listRef: Readonly<Ref<ReadonlyArray<HTMLElement | null>>>;
  /** Reads the highlighted index of the host. */
  getActiveIndex: () => number | null;
  /** Moves the highlight of the host. */
  setActiveIndex: (index: number | null) => void;
  /** The ref of the host for the input. */
  focusOwnerRef?: Ref<HTMLElement | null> | undefined;
}
</script>

<script setup lang="ts">
import { useFilterDropdownRoot } from '../../src/filter-dropdown/root/FilterDropdownRoot';

const props = withDefaults(defineProps<FilterDropdownRootPartProps>(), {
  query: undefined,
  filter: undefined,
});

const emit = defineEmits<{
  valueChange: [value: string, eventDetails: FilterDropdownRootChangeEventDetails];
}>();

defineSlots<{ default(): unknown }>();

useFilterDropdownRoot({
  open: () => props.open,
  disabled: () => props.disabled,
  openedByKeyboard: () => props.openedByKeyboard,
  locale: () => props.locale,
  value: () => props.value,
  query: () => props.query,
  onValueChange: (value, eventDetails) => emit('valueChange', value, eventDetails),
  filter: () => props.filter,
  autoHighlight: () => props.autoHighlight,
  triggerId: () => props.triggerId,
  listRef: props.listRef,
  getActiveIndex: () => props.getActiveIndex(),
  setActiveIndex: (index) => props.setActiveIndex(index),
  focusOwnerRef: props.focusOwnerRef,
});
</script>

<template>
  <slot />
</template>
