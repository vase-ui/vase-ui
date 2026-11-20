<script setup lang="ts">
import { computed, mergeProps, useAttrs, useId, watch } from 'vue';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { styleDisableScrollbar, useStyleDisableScrollbar } from '../utils/styles';
import { injectSelectPositioner, injectSelectRoot } from './root';
import type { SelectListProps, SelectListState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<SelectListProps>();
defineSlots<{
  default?(scope: { state: SelectListState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: SelectListState;
  }): unknown;
}>();

const context = injectSelectRoot('List');
const positioner = injectSelectPositioner('List');
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const state: SelectListState = {};

const elementId = computed(() => givenId(props.id) ?? generatedId);
watch(
  [element, elementId],
  ([list, current], _, onCleanup) => {
    if (!list) return;
    context.listElement.value = list;
    context.listId.value = current;
    onCleanup(() => {
      if (context.listElement.value !== list) return;
      context.listElement.value = null;
      context.listId.value = undefined;
    });
  },
  { flush: 'sync', immediate: true },
);

const hidesScrollbar = computed(
  () => (context.arrows.value > 0 && context.root.interaction !== 'touch') || context.aligned.value,
);
useStyleDisableScrollbar(() => (hidesScrollbar.value ? element.value : null));

function elementProps() {
  return mergeProps(
    {
      id: elementId.value,
      role: 'listbox',
      tabindex: -1,
      'aria-multiselectable': context.multiple ? 'true' : undefined,
      'aria-readonly': context.readonly ? 'true' : undefined,
      class: hidesScrollbar.value ? styleDisableScrollbar.className : undefined,
      // The list scrolls in a popup that covers the trigger.
      style: context.aligned.value
        ? { position: 'relative', maxHeight: '100%', overflowX: 'hidden', overflowY: 'auto' }
        : undefined,
      onScroll: (event: Event) => positioner.onScroll(event.currentTarget as HTMLElement),
    },
    attrs,
  );
}

defineExpose({ element });
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
