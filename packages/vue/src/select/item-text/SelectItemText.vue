<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface SelectItemTextState {}

export interface SelectItemTextProps
  extends
    VaseUIComponentProps<SelectItemTextState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useSelectItemContext } from '../item/SelectItemContext';
import { useSelectRootContext } from '../root/SelectRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectItemTextProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: SelectItemTextState }): unknown;
  render: ComponentRenderFn<HTMLProps, SelectItemTextState>;
}>();

const { index, textRef, selectedByFocus } = useSelectItemContext();
const store = useSelectRootContext();
const state: SelectItemTextState = EMPTY_OBJECT;

let textElement: HTMLElement | null = null;

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [
    (node) => {
      // A compiled template can mount a new text before it unmounts the old one. The old one then
      // must not clear the element of the new one.
      if (node !== null || textRef.value === textElement) {
        textRef.value = node;
      }
      textElement = node;
    },
  ],
});

// A `ref` callback must not read the index, because Vue calls it during a render. The popup reads
// these elements when it opens, after the DOM update.
function publishTextElement() {
  const node = element.value;
  if (!node) {
    return;
  }

  if (index.value === 0) {
    store.context.firstItemTextRef.value = node;
  }
  if (selectedByFocus.value) {
    store.context.selectedItemTextRef.value = node;
  }
}

onMounted(publishTextElement);
watch([element, index, selectedByFocus], publishTextElement, { flush: 'post' });

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
