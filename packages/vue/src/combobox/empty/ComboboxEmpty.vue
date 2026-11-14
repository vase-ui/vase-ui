<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface ComboboxEmptyState {}

export interface ComboboxEmptyProps
  extends VaseUIComponentProps<ComboboxEmptyState>, /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { EMPTY_OBJECT } from '../../common/empty';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useInitialLiveRegionTextMutation } from '../../internals/useInitialLiveRegionTextMutation';
import { useRenderElement } from '../../internals/useRenderElement';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { useListEmpty } from '../utils/parts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxEmptyProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ComboboxEmptyState }): unknown;
  render: ComponentRenderFn<HTMLProps, ComboboxEmptyState>;
}>();

const store = useComboboxRootContext();
const empty = useListEmpty();
const emptyRef = useInitialLiveRegionTextMutation<HTMLElement>();

// A template can mount the part that replaces this part before it unmounts this part. The part then
// clears the element of the root only when the root holds its own element.
let ownElement: HTMLElement | null = null;
function setEmptyElement(element: HTMLElement | null) {
  if (element !== null || store.context.emptyRef.value === ownElement) {
    store.context.emptyRef.value = element as HTMLDivElement | null;
  }
  ownElement = element;
}

const state: ComboboxEmptyState = EMPTY_OBJECT;

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [setEmptyElement, emptyRef],
  props: (attrs) => [{ role: 'status', 'aria-live': 'polite', 'aria-atomic': true }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"
    ><slot v-if="empty" :state="state"
  /></component>
</template>
