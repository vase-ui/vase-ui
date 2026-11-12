<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { ProgressRootState } from '../root/ProgressRoot.vue';

export interface ProgressIndicatorState extends ProgressRootState {}

export interface ProgressIndicatorProps
  extends
    VaseUIComponentProps<ProgressIndicatorState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useProgressRootContext } from '../root/ProgressRootContext';
import { progressStateAttributesMapping } from '../root/stateAttributesMapping';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ProgressIndicatorProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ProgressIndicatorState }): unknown;
  render: ComponentRenderFn<HTMLProps, ProgressIndicatorState>;
}>();

const { percentageValue, state } = useProgressRootContext();

// An empty `style` key gives `style=""` in the server HTML and no attribute in a browser, so the
// indeterminate state has no `style` key.
const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [
    percentageValue.value == null
      ? undefined
      : { style: { insetInlineStart: 0, height: 'inherit', width: `${percentageValue.value}%` } },
    attrs,
  ],
  stateAttributesMapping: progressStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
