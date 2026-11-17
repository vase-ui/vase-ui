<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type { FilterDropdownClearState } from '../../filter-dropdown/clear/FilterDropdownClear';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';

export interface MenuClearState extends FilterDropdownClearState {}

export interface MenuClearProps
  extends
    NativeButtonProps,
    VaseUIComponentProps<MenuClearState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<ButtonHTMLAttributes>, 'disabled'> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { useFilterDropdownClear } from '../../filter-dropdown/clear/FilterDropdownClear';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../internals/useRenderElement';
import { useMenuFilterPart } from '../filter-root/MenuFilterContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuClearProps>(), {
  as: 'button',
  nativeButton: true,
  disabled: false,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Menu.Clear');
}

defineSlots<{
  default(props: { state: MenuClearState }): unknown;
  render: ComponentRenderFn<HTMLProps, MenuClearState>;
}>();

useMenuFilterPart('Clear');

const clear = useFilterDropdownClear({
  disabled: () => props.disabled,
  nativeButton: () => props.nativeButton,
});

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('button', props, {
  state: clear.state,
  ref: clear.ref,
  props: clear.props,
});

defineExpose({ element });
</script>

<template>
  <slot
    v-if="clear.visible.value && usesRenderSlot()"
    name="render"
    :props="elementProps()"
    :state="clear.state.value"
  />
  <component :is="as" v-else-if="clear.visible.value" v-bind="elementProps()" :ref="setRef"
    ><slot :state="clear.state.value"
  /></component>
</template>
