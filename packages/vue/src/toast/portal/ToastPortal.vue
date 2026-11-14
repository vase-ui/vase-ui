<script lang="ts">
import type {
  FloatingPortalLiteProps,
  FloatingPortalLiteState,
} from '../../utils/popups/portal/FloatingPortalLite.vue';

export interface ToastPortalState extends FloatingPortalLiteState {}

export interface ToastPortalProps extends FloatingPortalLiteProps {}
</script>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import FloatingPortalLite from '../../utils/popups/portal/FloatingPortalLite.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToastPortalProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ToastPortalState }): unknown;
  render: ComponentRenderFn<HTMLProps, ToastPortalState>;
}>();

// As in Base UI, this part renders the portal of the popups and makes no element of its own.
const portalRef = useTemplateRef('portal');
const element = computed(() => portalRef.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <FloatingPortalLite ref="portal" v-bind="{ ...$attrs, ...props }">
    <template v-if="$slots.render" #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
    <template v-if="$slots.default" #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </FloatingPortalLite>
</template>
