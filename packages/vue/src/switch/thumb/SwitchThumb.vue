<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { SwitchRootState } from '../root/SwitchRoot.vue';

export interface SwitchThumbState extends SwitchRootState {}

export interface SwitchThumbProps
  extends
    VaseUIComponentProps<SwitchThumbState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { inject } from 'vue';
import { SwitchRootContext, stateAttributesMapping } from '../root/SwitchRoot.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SwitchThumbProps>(), { as: 'span' });

defineSlots<{
  default(props: { state: SwitchThumbState }): unknown;
  render: ComponentRenderFn<HTMLProps, SwitchThumbState>;
}>();

const state = inject(SwitchRootContext, undefined);
if (!state) {
  throw new Error(
    'Vase UI: A part of Switch must be inside <Switch.Root>. Without a root the part has no state to show. Put the part inside <Switch.Root>.',
  );
}

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('span', props, {
  state,
  stateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
