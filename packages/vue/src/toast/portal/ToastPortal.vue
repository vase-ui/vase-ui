<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { PortalTargetProps } from '../../utils/popups/portal/PopupPortal.vue';

export interface ToastPortalState {}

export interface ToastPortalProps
  extends
    PortalTargetProps,
    VaseUIComponentProps<ToastPortalState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import type { Component } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import type { HTMLProps } from '../../internals/types';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import PopupPortal from '../../utils/popups/portal/PopupPortal.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToastPortalProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ToastPortalState }): unknown;
  render(props: { props: HTMLProps; state: ToastPortalState; children: Component }): unknown;
}>();

const state: ToastPortalState = EMPTY_OBJECT;

// Separate branches keep the content slot stable across parent updates.
const portalRef = useTemplateRef('portal');
const element = computed(() => portalRef.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <PopupPortal
    v-if="$slots.render"
    ref="portal"
    v-bind="{ ...withoutPropsOf($attrs, PopupPortal), ...props }"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </PopupPortal>
  <PopupPortal v-else ref="portal" v-bind="{ ...withoutPropsOf($attrs, PopupPortal), ...props }">
    <slot :state="state" />
  </PopupPortal>
</template>
