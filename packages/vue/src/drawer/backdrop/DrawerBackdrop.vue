<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

export interface DrawerBackdropProps
  extends
    VaseUIComponentProps<DrawerBackdropState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Whether the backdrop is forced to render even when nested.
   * @default false
   */
  forceRender?: boolean | undefined;
}

export interface DrawerBackdropState {
  /**
   * Whether the drawer is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}
</script>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useDialogRootContext } from '../dialog/root/DialogRootContext';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { createElementSetter } from '../../utils/popups/createElementSetter';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { useDrawerRootContext } from '../root/DrawerRootContext';
import * as DrawerPopupDataAttributes from '../popup/DrawerPopupDataAttributes';
import * as DrawerPopupCssVars from '../popup/DrawerPopupCssVars';
import * as DrawerBackdropCssVars from './DrawerBackdropCssVars';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DrawerBackdropProps>(), { as: 'div', forceRender: false });

defineSlots<{
  default(props: { state: DrawerBackdropState }): unknown;
  render: ComponentRenderFn<HTMLProps, DrawerBackdropState>;
}>();

const store = useDialogRootContext();

const open = computed(() => store.select('open'));
const nested = computed(() => store.select('nested'));
const mounted = computed(() => store.select('mounted'));

const state = computed<DrawerBackdropState>(() => ({
  open: open.value,
  transitionStatus: store.select('transitionStatus'),
}));

const root = useDrawerRootContext(true);
// A nested dialog can have a drawer ancestor and its own backdrop.
const drawer = root?.dialogContext === store.context ? root : undefined;
const viewportGesture = drawer?.viewportGesture;
const openingSwipe = drawer?.openingSwipe;
const height = computed(
  () => openingSwipe?.value?.height.value ?? viewportGesture?.value?.height.value ?? 0,
);

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  ref: createElementSetter(store.context.backdropRef, { keepWhileHeld: true }),
  stateAttributesMapping: popupTransitionStateMapping,
  props: (attrs) => [
    {
      role: 'presentation',
      [DrawerPopupDataAttributes.swiping]:
        openingSwipe?.value || viewportGesture?.value?.swiping.value ? '' : undefined,
      [DrawerPopupDataAttributes.swipeDismiss]: viewportGesture?.value?.release.value
        ? ''
        : undefined,
      hidden: mounted.value ? undefined : true,
      style: {
        'pointer-events': open.value ? undefined : 'none',
        'user-select': 'none',
        '-webkit-user-select': 'none',
        [DrawerBackdropCssVars.swipeProgress]:
          openingSwipe?.value?.progress ?? viewportGesture?.value?.getProgress() ?? 0,
        [DrawerPopupCssVars.height]: height.value > 0 ? `${height.value}px` : undefined,
        [DrawerPopupCssVars.swipeStrength]: viewportGesture?.value?.release.value?.strength ?? 1,
      },
    },
    attrs,
  ],
});

watch(
  element,
  (backdrop, _, onCleanup) => {
    // A retained backdrop has no further patch after Vue releases it.
    if (backdrop) {
      onCleanup(() => backdrop.removeAttribute(DrawerPopupDataAttributes.swiping));
    }
  },
  { flush: 'post' },
);

defineExpose({ element });
</script>

<template>
  <slot
    v-if="(forceRender || !nested) && usesRenderSlot()"
    name="render"
    :props="elementProps()"
    :state="state"
  />
  <component :is="as" v-else-if="forceRender || !nested" v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
