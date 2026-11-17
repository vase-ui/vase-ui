<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

export interface SelectItemIndicatorState {
  /**
   * Whether the item is selected.
   */
  selected: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface SelectItemIndicatorProps
  extends
    VaseUIComponentProps<SelectItemIndicatorState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Whether to keep the HTML element in the DOM when the item is not selected.
   */
  keepMounted?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import ItemIndicator from '../../utils/ItemIndicator.vue';
import { useSelectItemContext } from '../item/SelectItemContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectItemIndicatorProps>(), { as: 'span' });

defineSlots<{
  default(props: { state: SelectItemIndicatorState }): unknown;
  render: ComponentRenderFn<HTMLProps, SelectItemIndicatorState>;
}>();

const { selected } = useSelectItemContext();

const shouldRender = computed(() => props.keepMounted || selected.value);

// As in Base UI, this part renders `ItemIndicator` and makes no element of its own. It mounts that
// part only while the item is selected or `keepMounted` is set.
// The template has one form for `#render` and one for the content. A `v-if` on a slot template
// makes the slots of `ItemIndicator` dynamic. Vue then renders `ItemIndicator` again each time this
// part renders. It also renders again each part in that slot that has slot content.
const indicator = useTemplateRef('indicator');
const element = computed(() => indicator.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <ItemIndicator
    v-if="shouldRender && $slots.render"
    ref="indicator"
    v-bind="{ ...withoutPropsOf($attrs, ItemIndicator), as, stateClass, stateStyle }"
    :selected="selected"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </ItemIndicator>
  <ItemIndicator
    v-else-if="shouldRender"
    ref="indicator"
    v-bind="{ ...withoutPropsOf($attrs, ItemIndicator), as, stateClass, stateStyle }"
    :selected="selected"
  >
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </ItemIndicator>
</template>
