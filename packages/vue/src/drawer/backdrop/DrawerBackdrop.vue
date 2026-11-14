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
import { computed } from 'vue';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
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

// A template can mount the backdrop that replaces this backdrop before it unmounts this backdrop.
// The backdrop then clears the ref of the root only when the ref holds its own element.
let ownBackdrop: HTMLDivElement | null = null;
function setBackdrop(element: HTMLElement | null) {
  const backdrop = element as HTMLDivElement | null;
  if (backdrop !== null || store.context.backdropRef.value === ownBackdrop) {
    store.context.backdropRef.value = backdrop;
  }
  ownBackdrop = backdrop;
}

// A swipe writes its progress to the element in each frame. Vue writes each key of the style again
// when the part renders, so the render gives the value that the element holds.
function swipeProgressValue() {
  return ownBackdrop?.style.getPropertyValue(DrawerBackdropCssVars.swipeProgress) || '0';
}

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: setBackdrop,
  stateAttributesMapping: popupTransitionStateMapping,
  props: (attrs) => [
    {
      role: 'presentation',
      hidden: mounted.value ? undefined : true,
      style: {
        'pointer-events': open.value ? undefined : 'none',
        'user-select': 'none',
        '-webkit-user-select': 'none',
        [DrawerBackdropCssVars.swipeProgress]: swipeProgressValue(),
        [DrawerPopupCssVars.swipeStrength]: '1',
      },
    },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <template v-if="forceRender || !nested">
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
    <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
  </template>
</template>
