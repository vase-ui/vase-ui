<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { WithVaseUIEvent } from '../../src/internals/types';

export interface FilterDropdownPopupPartProps extends /* @vue-ignore */ WithVaseUIEvent<
  Omit<HTMLAttributes, 'id'>
> {
  /** The `id` of the popup. */
  id?: string | undefined;
}
</script>

<script setup lang="ts">
import { useAttrs } from 'vue';
import { useFilterDropdownRootContext } from '../../src/filter-dropdown/root/FilterDropdownRootContext';
import { useVaseUiId } from '../../src/internals/useBaseUiId';
import { mergeProps } from '../../src/merge-props';

defineOptions({ inheritAttrs: false });

const props = defineProps<FilterDropdownPopupPartProps>();

defineSlots<{ default(): unknown }>();

const attrs = useAttrs();
const popupId = useVaseUiId(() => props.id);
const { triggerId } = useFilterDropdownRootContext();

// A menu-shaped host with no floating popup and no list navigation.
function popupProps() {
  return mergeProps(
    { id: popupId.value, role: 'dialog', 'aria-labelledby': triggerId.value },
    attrs,
  );
}
</script>

<template>
  <div v-bind="popupProps()"><slot /></div>
</template>
