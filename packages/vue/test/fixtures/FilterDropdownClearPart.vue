<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type { FilterDropdownClearState } from '../../src/filter-dropdown/clear/FilterDropdownClear';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../src/internals/types';

export interface FilterDropdownClearPartProps
  extends
    VaseUIComponentProps<FilterDropdownClearState>,
    /* @vue-ignore */ WithVaseUIEvent<Omit<ButtonHTMLAttributes, 'disabled'>> {
  /** Whether the button ignores user interaction. */
  disabled?: boolean | undefined;
  /** Whether the element is a native `<button>`. */
  nativeButton?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { useFilterDropdownClear } from '../../src/filter-dropdown/clear/FilterDropdownClear';
import type { ComponentRenderFn, HTMLProps } from '../../src/internals/types';
import { useRenderElement } from '../../src/internals/useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<FilterDropdownClearPartProps>(), {
  as: 'button',
  nativeButton: true,
});

defineSlots<{
  default(props: { state: FilterDropdownClearState }): unknown;
  render: ComponentRenderFn<HTMLProps, FilterDropdownClearState>;
}>();

const {
  visible,
  state,
  button,
  props: clearProps,
} = useFilterDropdownClear({
  disabled: () => props.disabled,
  nativeButton: () => props.nativeButton,
});

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('button', props, {
  state,
  button,
  props: clearProps,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="visible && usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else-if="visible" v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
