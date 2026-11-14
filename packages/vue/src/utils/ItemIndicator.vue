<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../internals/types';
import type { TransitionStatus } from '../internals/useTransitionStatus';

export interface ItemIndicatorState {
  selected: boolean;
  transitionStatus: TransitionStatus;
}

export interface ItemIndicatorProps
  extends
    VaseUIComponentProps<ItemIndicatorState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  selected: boolean;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { transitionStatusMapping } from '../internals/stateAttributesMapping';
import type { ComponentRenderFn, HTMLProps } from '../internals/types';
import { useOpenChangeComplete } from '../internals/useOpenChangeComplete';
import { useRenderElement } from '../internals/useRenderElement';
import { useTransitionStatus } from '../internals/useTransitionStatus';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ItemIndicatorProps>(), { as: 'span' });

defineSlots<{
  default(props: { state: ItemIndicatorState }): unknown;
  render: ComponentRenderFn<HTMLProps, ItemIndicatorState>;
}>();

// The public parts mount this component only while the item is selected or kept mounted.
// The getter for `element` runs after `setup`, so the later declaration of `element` is in scope.
const { transitionStatus, setMounted } = useTransitionStatus(
  () => props.selected,
  false,
  false,
  false,
  () => element.value,
);

const state = computed<ItemIndicatorState>(() => ({
  selected: props.selected,
  transitionStatus: transitionStatus.value,
}));

const { element, elementProps } = useRenderElement('span', props, {
  state,
  stateAttributesMapping: transitionStatusMapping,
  props: (attrs) => [{ 'aria-hidden': true }, attrs],
});

useOpenChangeComplete({
  batch: true,
  enabled: () => !props.selected,
  open: () => props.selected,
  ref: element,
  onComplete() {
    if (!props.selected) {
      setMounted(false);
    }
  },
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"
    ><slot :state="state">{{ '✔️' }}</slot></component
  >
</template>
