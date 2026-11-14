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
import type { ComponentPublicInstance } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import InternalBackdrop from '../../utils/popups/InternalBackdrop.vue';
import FloatingPortal from '../../utils/popups/portal/FloatingPortal.vue';
import { useDialogRootContext } from '../root/DialogRootContext';
import { DialogPortalContext } from './DialogPortalContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DialogPortalProps>(), { as: 'div', keepMounted: false });

defineSlots<{
  default(props: { state: DialogPortalState }): unknown;
  render: ComponentRenderFn<HTMLProps, DialogPortalState>;
}>();

const store = useDialogRootContext();

const mounted = computed(() => store.select('mounted'));
const modal = computed(() => store.select('modal'));
const open = computed(() => store.select('open'));

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

let internalBackdropElement: HTMLDivElement | null = null;

// Vue calls this function before it sets the exposed `element` of the backdrop. `$el` is the
// element of the backdrop at that time.
function setInternalBackdrop(instance: Element | ComponentPublicInstance | null) {
  const backdrop = (instance as ComponentPublicInstance | null)?.$el ?? null;
  const internalBackdropRef = store.context.internalBackdropRef;
  if (backdrop) {
    internalBackdropRef.value = backdrop;
  } else if (internalBackdropRef.value === internalBackdropElement) {
    internalBackdropRef.value = null;
  }
  internalBackdropElement = backdrop;
}

defineExpose({ element });
</script>

<template>
  <FloatingPortal v-if="mounted || keepMounted" ref="portal" v-bind="{ ...$attrs, ...portalProps }">
    <template v-if="$slots.render" #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
    <template #default="slotProps">
      <InternalBackdrop v-if="mounted && modal === true" :ref="setInternalBackdrop" :inert="!open" />
      <slot v-bind="slotProps" />
    </template>
  </FloatingPortal>
</template>
