<script lang="ts">
import type { InputHTMLAttributes } from 'vue';
import type { FilterDropdownInputState } from '../../src/filter-dropdown/input/FilterDropdownInput';
import type { HTMLProps, VaseUIComponentProps, WithVaseUIEvent } from '../../src/internals/types';

export interface FilterDropdownInputPartProps
  extends
    VaseUIComponentProps<FilterDropdownInputState>,
    /* @vue-ignore */ WithVaseUIEvent<Omit<InputHTMLAttributes, 'id' | 'disabled'>> {
  /** The `id` of the input. */
  id?: string | undefined;
  /** Whether the input ignores user interaction. */
  disabled?: boolean | undefined;
  /** The id of the item that the host highlights. */
  activeItemId?: string | undefined;
  /** The list navigation props of the host. */
  navigationProps?: HTMLProps | undefined;
}
</script>

<script setup lang="ts">
import { useFilterDropdownInput } from '../../src/filter-dropdown/input/FilterDropdownInput';
import type { ComponentRenderFn } from '../../src/internals/types';
import { useRenderElement } from '../../src/internals/useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<FilterDropdownInputPartProps>(), { as: 'input' });

defineSlots<{
  render: ComponentRenderFn<HTMLProps, FilterDropdownInputState>;
}>();

const input = useFilterDropdownInput({
  id: () => props.id,
  disabled: () => props.disabled,
  activeItemId: () => props.activeItemId,
  navigationProps: () => props.navigationProps,
});

const { element, elementProps } = useRenderElement('input', props, {
  state: input.state,
  ref: [input.ref],
  props: input.props,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="input.state.value" />
  <component :is="as" v-else v-bind="elementProps()" />
</template>
