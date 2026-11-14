<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

export interface DialogBackdropState {
  /**
   * Whether the dialog is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface DialogBackdropProps
  extends
    VaseUIComponentProps<DialogBackdropState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Whether the backdrop is forced to render even when nested.
   * @default false
   */
  forceRender?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { useDialogRootContext } from '../root/DialogRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DialogBackdropProps>(), { as: 'div', forceRender: false });

defineSlots<{
  default(props: { state: DialogBackdropState }): unknown;
  render: ComponentRenderFn<HTMLProps, DialogBackdropState>;
}>();

const store = useDialogRootContext();

const mounted = computed(() => store.select('mounted'));
const nested = computed(() => store.select('nested'));

const state = computed<DialogBackdropState>(() => ({
  open: store.select('open'),
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

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: setBackdrop,
  stateAttributesMapping: popupTransitionStateMapping,
  props: (attrs) => [
    {
      role: 'presentation',
      hidden: mounted.value ? undefined : true,
      style: {
        'user-select': 'none',
        '-webkit-user-select': 'none',
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
