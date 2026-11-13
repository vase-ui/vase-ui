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
import { computed } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import { useRadioRootContext } from '../root/RadioRootContext';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<RadioIndicatorProps>(), {
  as: 'span',
  keepMounted: false,
});

defineSlots<{
  default(props: { state: RadioIndicatorState }): unknown;
  render: ComponentRenderFn<HTMLProps, RadioIndicatorState>;
}>();

const rootState = useRadioRootContext();

const rendered = computed(() => rootState.value.checked);

// The getter for `element` runs after `setup`, so the later declaration of `element` is in scope.
// The indicator has an enter transition, so the composable needs the element.
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

const { element, elementProps } = useRenderElement('span', props, {
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
  <template v-if="keepMounted || mounted">
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
    <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
  </template>
</template>
