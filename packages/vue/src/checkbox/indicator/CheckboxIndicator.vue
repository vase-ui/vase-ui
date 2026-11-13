<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { CheckboxRootState } from '../root/CheckboxRoot.vue';

export interface CheckboxIndicatorState extends CheckboxRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface CheckboxIndicatorProps
  extends
    VaseUIComponentProps<CheckboxIndicatorState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Whether to keep the element in the DOM when the checkbox is not checked.
   * @default false
   */
  keepMounted?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import { useCheckboxRootContext } from '../root/CheckboxRootContext';
import { getCheckboxStateAttributesMapping } from '../utils/getCheckboxStateAttributesMapping';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CheckboxIndicatorProps>(), {
  as: 'span',
  keepMounted: false,
});

defineSlots<{
  default(props: { state: CheckboxIndicatorState }): unknown;
  render: ComponentRenderFn<HTMLProps, CheckboxIndicatorState>;
}>();

const rootState = useCheckboxRootContext();

const rendered = computed(() => rootState.value.checked || rootState.value.indeterminate);

// The getter for `element` runs after `setup`, so the later declaration of `element` is in scope.
// The indicator has an enter transition, so the composable needs the element.
const { mounted, transitionStatus, setMounted } = useTransitionStatus(
  rendered,
  false,
  false,
  false,
  () => element.value,
);

const state = computed<CheckboxIndicatorState>(() => ({
  ...rootState.value,
  transitionStatus: transitionStatus.value,
}));

const stateAttributesMapping: StateAttributesMapping<CheckboxIndicatorState> = {
  ...getCheckboxStateAttributesMapping(rootState),
  ...transitionStatusMapping,
};

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
