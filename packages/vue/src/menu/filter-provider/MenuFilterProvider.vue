<script lang="ts">
import type {
  FilterDropdownRootChangeEventDetails,
  FilterDropdownRootChangeEventReason,
} from '../../filter-dropdown/root/FilterDropdownRootContext';
import type { MenuFilterProviderOptions } from './MenuFilterProviderOptions';

export interface MenuFilterProviderState {}

export interface MenuFilterProviderProps extends MenuFilterProviderOptions {}

export type MenuFilterProviderChangeEventReason = FilterDropdownRootChangeEventReason;
export type MenuFilterProviderChangeEventDetails = FilterDropdownRootChangeEventDetails;
</script>

<script setup lang="ts">
import { provide } from 'vue';
import { useMenuFilterRoot } from '../filter-root/useMenuFilterRoot';
import { MenuFilterProviderContext } from './MenuFilterProviderContext';

const props = withDefaults(defineProps<MenuFilterProviderProps>(), {
  filter: undefined,
  autoHighlight: false,
  locale: undefined,
  defaultValue: undefined,
  value: undefined,
});

const emit = defineEmits<{
  /**
   * Event handler called when the filter query changes.
   */
  valueChange: [value: string, eventDetails: MenuFilterProviderChangeEventDetails];
  'update:value': [value: string];
}>();

defineSlots<{
  /**
   * The `<Menu.Root>` or `<Menu.SubmenuRoot>` to make filterable.
   */
  default(): unknown;
}>();

provide(MenuFilterProviderContext, {
  useRoot: () =>
    useMenuFilterRoot({
      value: () => props.value,
      defaultValue: () => props.defaultValue,
      onValueChange(value, eventDetails) {
        emit('valueChange', value, eventDetails);
        if (!eventDetails.isCanceled) {
          emit('update:value', value);
        }
      },
      filter: () => props.filter,
      autoHighlight: () => props.autoHighlight,
      locale: () => props.locale,
    }),
});
</script>

<template>
  <slot />
</template>
