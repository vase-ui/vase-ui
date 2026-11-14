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
import type { Component } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import type { HTMLProps } from '../../internals/types';
import FloatingPortalLite from '../../utils/popups/portal/FloatingPortalLite.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToastPortalProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ToastPortalState }): unknown;
  render(props: { props: HTMLProps; state: ToastPortalState; children: Component }): unknown;
}>();

const state: ToastPortalState = EMPTY_OBJECT;

// As in Base UI, this part renders the portal of the popups and makes no element of its own.
// The template has one form for `#render` and one for the content. A `v-if` on a slot template
// makes the slots of the portal dynamic. Each part below the portal that has slot content then
// renders again with its parent.
const portalRef = useTemplateRef('portal');
const element = computed(() => portalRef.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <FloatingPortalLite v-if="$slots.render" ref="portal" v-bind="{ ...$attrs, ...props }">
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </FloatingPortalLite>
  <FloatingPortalLite v-else ref="portal" v-bind="{ ...$attrs, ...props }">
    <slot :state="state" />
  </FloatingPortalLite>
</template>
