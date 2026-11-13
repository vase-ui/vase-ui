<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { AccordionItemState } from '../item/AccordionItem.vue';

export interface AccordionHeaderState extends AccordionItemState {}

export interface AccordionHeaderProps
  extends
    VaseUIComponentProps<AccordionHeaderState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useAccordionItemContext } from '../item/AccordionItemContext';
import { accordionStateAttributesMapping } from '../item/stateAttributesMapping';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<AccordionHeaderProps>(), { as: 'h3' });

defineSlots<{
  default(props: { state: AccordionHeaderState }): unknown;
  render: ComponentRenderFn<HTMLProps, AccordionHeaderState>;
}>();

const { state } = useAccordionItemContext();

const { element, elementProps } = useRenderElement('h3', props, {
  state,
  stateAttributesMapping: accordionStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
