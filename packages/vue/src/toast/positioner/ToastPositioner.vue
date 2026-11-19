<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { Align, Side } from '../../internals/useAnchorPositioning';
import type { ToastManagerPositionerProps, ToastObject } from '../useToastManager';

export interface ToastPositionerState {
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
}

export interface ToastPositionerProps
  extends
    VaseUIComponentProps<ToastPositionerState>,
    ToastManagerPositionerProps,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * The toast object associated with the positioner.
   */
  toast: ToastObject<any>;
}
</script>

<script setup lang="ts">
import { isElement } from '@floating-ui/utils/dom';
import { computed, provide, shallowRef } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { usePositioner, usePopupPlacement } from '../../utils/popups/usePopupPositioner';
import { ToastPositionerContext, useToastProviderContext } from '../provider/ToastProviderContext';
import * as ToastRootCssVars from '../root/ToastRootCssVars';

defineOptions({ inheritAttrs: false });

// A positioning prop that is not set takes the value of `positionerProps` of the toast. A Boolean
// prop thus needs the default `undefined`, because Vue changes an absent Boolean prop to `false`.
const props = withDefaults(defineProps<ToastPositionerProps>(), {
  as: 'div',
  sticky: undefined,
  disableAnchorTracking: undefined,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Toast.Positioner');
}

defineSlots<{
  default(props: { state: ToastPositionerState }): unknown;
  render: ComponentRenderFn<HTMLProps, ToastPositionerState>;
}>();

const store = useToastProviderContext();

function resolve<Key extends keyof ToastManagerPositionerProps>(
  key: Key,
): ToastManagerPositionerProps[Key] {
  return props[key] !== undefined ? props[key] : props.toast.positionerProps?.[key];
}

const positionerElement = shallowRef<HTMLElement | null>(null);

const anchorElement = computed(() => {
  const value = resolve('anchor');
  return isElement(value) ? value : null;
});

const domIndex = computed(() => store.select('toastIndex', props.toast.id));
const visibleIndex = computed(() => store.select('toastVisibleIndex', props.toast.id));

const positioning = usePopupPlacement(resolve, {
  anchor: anchorElement,
  mounted: true,
  side: () => resolve('side') ?? 'top',
  keepMounted: true,
  positionerElement,
});

const state = computed<ToastPositionerState>(() => ({
  side: positioning.side.value,
  align: positioning.align.value,
  anchorHidden: positioning.anchorHidden.value,
}));

const { element, elementProps, setRef, usesRenderSlot } = usePositioner(props, {
  state,
  styles: () => ({
    ...positioning.positionerStyles.value,
    [ToastRootCssVars.index]:
      props.toast.transitionStatus === 'ending' ? domIndex.value : visibleIndex.value,
  }),
  transitionStatus: () => props.toast.transitionStatus,
  ref: (positioner) => {
    positionerElement.value = positioner;
  },
});

provide(ToastPositionerContext, positioning);

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
