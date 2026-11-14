<script lang="ts">
import type { HTMLAttributes, MaybeRefOrGetter } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { FloatingPortalContainer } from '../../utils/popups/portal/useFloatingPortalNode';

export interface DialogPortalState {}

export interface DialogPortalProps
  extends
    VaseUIComponentProps<DialogPortalState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Whether to keep the portal mounted in the DOM while the popup is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * A parent element to render the portal element into.
   */
  container?: MaybeRefOrGetter<FloatingPortalContainer> | undefined;
}
</script>

<script setup lang="ts">
import { computed, provide, useTemplateRef } from 'vue';
import type { Component } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import type { HTMLProps } from '../../internals/types';
import FloatingPortal from '../../utils/popups/portal/FloatingPortal.vue';
import { useDialogRootContext } from '../root/DialogRootContext';
import DialogPortalChildren from './DialogPortalChildren.vue';
import { DialogPortalContext } from './DialogPortalContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DialogPortalProps>(), { as: 'div', keepMounted: false });

defineSlots<{
  default(props: { state: DialogPortalState }): unknown;
  render(props: { props: HTMLProps; state: DialogPortalState; children: Component }): unknown;
}>();

const state: DialogPortalState = EMPTY_OBJECT;

const store = useDialogRootContext();

const shouldRender = computed(() => store.select('mounted') || props.keepMounted);

provide(
  DialogPortalContext,
  computed(() => props.keepMounted),
);

const portalProps = computed(() => {
  const { keepMounted, ...otherProps } = props;
  return otherProps;
});

// As in Base UI, this part renders `FloatingPortal` and makes no element of its own.
// The template has one form for `#render` and one for the content. A `v-if` on a slot template
// makes the slots of the portal dynamic. Each part below the portal that has slot content then
// renders again with its parent.
const portal = useTemplateRef('portal');
const element = computed(() => portal.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <FloatingPortal
    v-if="shouldRender && $slots.render"
    ref="portal"
    v-bind="{ ...$attrs, ...portalProps }"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" :children="DialogPortalChildren" />
    </template>
  </FloatingPortal>
  <FloatingPortal v-else-if="shouldRender" ref="portal" v-bind="{ ...$attrs, ...portalProps }">
    <DialogPortalChildren><slot :state="state" /></DialogPortalChildren>
  </FloatingPortal>
</template>
