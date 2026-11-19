<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { RadioRootState } from '../root/RadioRoot.vue';

export interface RadioIndicatorState extends RadioRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface RadioIndicatorProps
  extends
    VaseUIComponentProps<RadioIndicatorState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Whether to keep the HTML element in the DOM when the radio button is inactive.
   * @default false
   */
  keepMounted?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed, inject } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import { RadioRootContext, stateAttributesMapping } from '../../radio-group/radioContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<RadioIndicatorProps>(), {
  as: 'span',
  keepMounted: false,
});

defineSlots<{
  default(props: { state: RadioIndicatorState }): unknown;
  render: ComponentRenderFn<HTMLProps, RadioIndicatorState>;
}>();

const rootState = inject(RadioRootContext, undefined);
if (!rootState) {
  throw new Error(
    'Vase UI: A part of Radio must be inside <Radio.Root>. Without a root the part has no state to show. Put the part inside <Radio.Root>.',
  );
}

const rendered = computed(() => rootState.value.checked);

const { mounted, transitionStatus, setMounted } = useTransitionStatus(
  rendered,
  false,
  false,
  false,
  () => element.value,
);

const state = computed<RadioIndicatorState>(() => ({
  ...rootState.value,
  transitionStatus: transitionStatus.value,
}));

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('span', props, {
  state,
  stateAttributesMapping,
});

useOpenChangeComplete({
  batch: true,
  enabled: () => !rendered.value,
  open: rendered,
  ref: element,
  onComplete() {
    if (!rendered.value) {
      setMounted(false);
    }
  },
});

defineExpose({ element });
</script>

<template>
  <slot
    v-if="(keepMounted || mounted) && usesRenderSlot()"
    name="render"
    :props="elementProps()"
    :state="state"
  />
  <component :is="as" v-else-if="keepMounted || mounted" v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
