<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../../internals/types';
import type { PortalTargetProps } from '../../../utils/popups/portal/PopupPortal.vue';

export interface DialogPortalState {}

export interface DialogPortalProps
  extends
    PortalTargetProps,
    VaseUIComponentProps<DialogPortalState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Whether to keep the portal mounted in the DOM while the popup is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { usePortalFocus } from '../../../utils/popups/portal/usePortalFocus';
import { computed, provide, useTemplateRef } from 'vue';
import type { Component } from 'vue';
import { EMPTY_OBJECT } from '../../../common/empty';
import type { HTMLProps } from '../../../internals/types';
import { withoutPropsOf } from '../../../internals/withoutPropsOf';
import PopupPortal from '../../../utils/popups/portal/PopupPortal.vue';
import { useDialogRootContext } from '../root/DialogRootContext';
import PopupBackdropChildren, {
  PopupBackdropContext,
} from '../../../utils/popups/portal/PopupBackdropChildren.vue';
import { DialogPortalContext } from './DialogPortalContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DialogPortalProps>(), {
  as: 'div',
  keepMounted: false,
  disabled: false,
});

defineSlots<{
  default(props: { state: DialogPortalState }): unknown;
  render(props: { props: HTMLProps; state: DialogPortalState; children: Component }): unknown;
}>();

const state: DialogPortalState = EMPTY_OBJECT;

const store = useDialogRootContext();

provide(PopupBackdropContext, () => {
  if (!store.select('mounted') || store.select('modal') !== true) return null;
  return { inert: !store.select('open'), target: store.context.internalBackdropRef };
});

const shouldRender = computed(() => store.select('mounted') || props.keepMounted);

provide(
  DialogPortalContext,
  computed(() => props.keepMounted),
);

const portal = useTemplateRef('portal');
const element = computed(() => portal.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <PopupPortal
    v-if="shouldRender && $slots.render"
    ref="portal"
    :guards="usePortalFocus"
    v-bind="{ ...withoutPropsOf($attrs, PopupPortal), as, to, disabled }"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" :children="PopupBackdropChildren" />
    </template>
  </PopupPortal>
  <PopupPortal
    v-else-if="shouldRender"
    ref="portal"
    :guards="usePortalFocus"
    v-bind="{ ...withoutPropsOf($attrs, PopupPortal), as, to, disabled }"
  >
    <PopupBackdropChildren><slot :state="state" /></PopupBackdropChildren>
  </PopupPortal>
</template>
