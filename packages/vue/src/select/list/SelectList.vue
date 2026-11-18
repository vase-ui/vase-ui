<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface SelectListState {}

export interface SelectListProps
  extends
    VaseUIComponentProps<SelectListState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { EMPTY_OBJECT } from '../../common/empty';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { createElementSetter, stateElementTarget } from '../../utils/popups/createElementSetter';
import { styleDisableScrollbar } from '../../utils/styles';
import { LIST_FUNCTIONAL_STYLES } from '../popup/utils';
import { useSelectPositionerContext } from '../positioner/SelectPositionerContext';
import { useSelectRootContext } from '../root/SelectRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectListProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: SelectListState }): unknown;
  render: ComponentRenderFn<HTMLProps, SelectListState>;
}>();

const store = useSelectRootContext();
const { alignItemWithTriggerActive } = useSelectPositionerContext();
const state: SelectListState = EMPTY_OBJECT;

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement<
  SelectListState,
  HTMLElement
>('div', props, {
  state,
  ref: createElementSetter(stateElementTarget(store, 'listElement')),
  props: (attrs) => [
    {
      id: `${store.select('id')}-list`,
      role: 'listbox',
      'aria-multiselectable': store.select('multiple') || undefined,
      'aria-readonly': store.select('readOnly') || undefined,
      onScroll(event: Event) {
        store.context.scrollHandlerRef.value?.(event.currentTarget as HTMLDivElement);
      },
      style: alignItemWithTriggerActive.value ? LIST_FUNCTIONAL_STYLES : undefined,
      class:
        store.select('hasScrollArrows') && store.select('openMethod') !== 'touch'
          ? styleDisableScrollbar.className
          : undefined,
    },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
