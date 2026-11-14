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

const store = useDialogRootContext();

const mounted = computed(() => store.select('mounted'));

provide(
  DialogPortalContext,
  computed(() => props.keepMounted),
);

const portalProps = computed(() => {
  const { keepMounted, ...otherProps } = props;
  return otherProps;
});

// As in Base UI, this part renders `FloatingPortal` and makes no element of its own.
const portal = useTemplateRef('portal');
const element = computed(() => portal.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <FloatingPortal v-if="mounted || keepMounted" ref="portal" v-bind="{ ...$attrs, ...portalProps }">
    <template v-if="$slots.render" #render="slotProps">
      <slot name="render" v-bind="slotProps" :children="DialogPortalChildren" />
    </template>
    <template #default="slotProps">
      <DialogPortalChildren><slot v-bind="slotProps" /></DialogPortalChildren>
    </template>
  </FloatingPortal>
</template>
