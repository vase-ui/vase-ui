<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface ComboboxChipsState {}

export interface ComboboxChipsProps
  extends
    VaseUIComponentProps<ComboboxChipsState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed, provide, shallowRef, toRaw } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import { useCompositeList } from '../../internals/composite/list/useCompositeList';
import type { ComponentRenderFn, HTMLProps, VaseUIEvent } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { handleInputPress } from '../utils/handleInputPress';
import { ComboboxChipsContext } from './ComboboxChipsContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxChipsProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ComboboxChipsState }): unknown;
  render: ComponentRenderFn<HTMLProps, ComboboxChipsState>;
}>();

const store = useComboboxRootContext();

const hasSelectionChips = computed(() => store.select('hasSelectionChips'));

const chipsRef = shallowRef<Array<HTMLButtonElement | null>>([]);
useCompositeList({ elementsRef: chipsRef });
provide(ComboboxChipsContext, { chipsRef });

// A template can mount the chips that replace these chips before it unmounts these chips. The old
// chips then clear the container of the root only when the root holds their own element.
let ownContainer: HTMLElement | null = null;
function setChipsContainer(container: HTMLElement | null) {
  if (container !== null || store.context.chipsContainerRef.value === ownContainer) {
    store.context.chipsContainerRef.value = container as HTMLDivElement | null;
  }
  ownContainer = container;
}

function handleMousedown(event: VaseUIEvent<MouseEvent>) {
  handleInputPress(event, store, toRaw(store.state).disabled);
}

const state: ComboboxChipsState = EMPTY_OBJECT;

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: setChipsContainer,
  props: (attrs) => [
    // NVDA enters browse mode instead of staying in focus mode when navigating with arrow keys
    // inside a container unless it has a toolbar role.
    hasSelectionChips.value ? { role: 'toolbar' } : EMPTY_OBJECT,
    { onMousedown: handleMousedown },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
