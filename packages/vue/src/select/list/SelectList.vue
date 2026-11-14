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
import { toRaw } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useSelectRootContext } from '../root/SelectRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectListProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: SelectListState }): unknown;
  render: ComponentRenderFn<HTMLProps, SelectListState>;
}>();

const store = useSelectRootContext();
const state: SelectListState = EMPTY_OBJECT;

let listElement: HTMLElement | null = null;

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [
    (list) => {
      // A compiled template can mount a new list before it unmounts the old one. The old one then
      // must not clear the element of the new one.
      if (list !== null || toRaw(store.state).listElement === listElement) {
        store.set('listElement', list as HTMLDivElement | null);
      }
      listElement = list;
    },
  ],
  props: (attrs) => [
    {
      id: `${store.select('id')}-list`,
      role: 'listbox',
      'aria-multiselectable': store.select('multiple') || undefined,
      'aria-readonly': store.select('readOnly') || undefined,
    },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
