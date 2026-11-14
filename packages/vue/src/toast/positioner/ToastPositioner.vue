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
import { EMPTY_OBJECT } from '../../common/empty';
import { POPUP_COLLISION_AVOIDANCE } from '../../internals/constants';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useAnchorPositioning } from '../../internals/useAnchorPositioning';
import { usePositioner } from '../../utils/popups/positioning/usePositioner';
import { useToastProviderContext } from '../provider/ToastProviderContext';
import * as ToastRootCssVars from '../root/ToastRootCssVars';
import { ToastPositionerContext } from './ToastPositionerContext';

defineOptions({ inheritAttrs: false });

// A positioning prop that is not set takes the value of `positionerProps` of the toast. A Boolean
// prop thus needs the default `undefined`, because Vue changes an absent Boolean prop to `false`.
const props = withDefaults(defineProps<ToastPositionerProps>(), {
  as: 'div',
  sticky: undefined,
  disableAnchorTracking: undefined,
});

defineSlots<{
  default(props: { state: ToastPositionerState }): unknown;
  render: ComponentRenderFn<HTMLProps, ToastPositionerState>;
}>();

const store = useToastProviderContext();

function resolve<Key extends keyof ToastManagerPositionerProps>(
  key: Key,
): ToastManagerPositionerProps[Key] {
  const value = props[key];
  if (value !== undefined) {
    return value;
  }
  const positionerProps: ToastManagerPositionerProps = props.toast.positionerProps ?? EMPTY_OBJECT;
  return positionerProps[key];
}

const positionerElement = shallowRef<HTMLElement | null>(null);

const anchorElement = computed(() => {
  const value = resolve('anchor');
  return isElement(value) ? value : null;
});

const domIndex = computed(() => store.select('toastIndex', props.toast.id));
const visibleIndex = computed(() => store.select('toastVisibleIndex', props.toast.id));

const positioning = useAnchorPositioning({
  anchor: () => anchorElement.value,
  positionMethod: () => resolve('positionMethod'),
  mounted: true,
  side: () => resolve('side') ?? 'top',
  sideOffset: () => resolve('sideOffset'),
  align: () => resolve('align') ?? 'center',
  alignOffset: () => resolve('alignOffset'),
  collisionBoundary: () => resolve('collisionBoundary'),
  collisionPadding: () => resolve('collisionPadding'),
  sticky: () => resolve('sticky'),
  arrowPadding: () => resolve('arrowPadding'),
  disableAnchorTracking: () => resolve('disableAnchorTracking'),
  keepMounted: true,
  collisionAvoidance: () => resolve('collisionAvoidance') ?? POPUP_COLLISION_AVOIDANCE,
  positionerElement,
});

const state = computed<ToastPositionerState>(() => ({
  side: positioning.side.value,
  align: positioning.align.value,
  anchorHidden: positioning.anchorHidden.value,
}));

const { element, elementProps } = usePositioner(props, {
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
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
