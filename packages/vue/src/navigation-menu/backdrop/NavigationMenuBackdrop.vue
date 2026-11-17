<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

export interface NavigationMenuBackdropState {
  /**
   * If `true`, the popup is open.
   */
  open: boolean;
  /**
   * The transition status of the popup.
   */
  transitionStatus: TransitionStatus;
}

export interface NavigationMenuBackdropProps
  extends
    VaseUIComponentProps<NavigationMenuBackdropState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}

const BACKDROP_STYLE = { 'user-select': 'none', '-webkit-user-select': 'none' };
</script>

<script setup lang="ts">
import { computed } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { createElementSetter } from '../../utils/popups/createElementSetter';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NavigationMenuBackdropProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: NavigationMenuBackdropState }): unknown;
  render: ComponentRenderFn<HTMLProps, NavigationMenuBackdropState>;
}>();

const { open, mounted, transitionStatus, backdropElement } = useNavigationMenuRootContext();

const state = computed<NavigationMenuBackdropState>(() => ({
  open: open.value,
  transitionStatus: transitionStatus.value,
}));

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  ref: createElementSetter(backdropElement),
  stateAttributesMapping: popupTransitionStateMapping,
  props: (attrs) => [
    { role: 'presentation', hidden: mounted.value ? undefined : true, style: BACKDROP_STYLE },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
