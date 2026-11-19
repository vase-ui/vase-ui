<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../../internals/types';
import type { usePortalFocus } from './usePortalFocus';

export type PortalTarget = string | Element | ShadowRoot | null;
export interface PopupPortalState {}
export interface PortalTargetProps {
  /**
   * A CSS selector, an element or a shadow root. The default is the nearest portal or the document body.
   * An explicit null delays the portal. A selector resolves after the client mount.
   */
  to?: PortalTarget | undefined;
  /**
   * Render the portal at its source, also on the server. A change of this prop mounts the content again.
   * @default false
   */
  disabled?: boolean | undefined;
}
export interface PopupPortalProps extends PortalTargetProps, VaseUIComponentProps<PopupPortalState>, /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  guards?: typeof usePortalFocus | undefined;
  portalOwnerRole?: string | undefined;
}
</script>

<script setup lang="ts">
import { computed, inject, provide, shallowRef, Teleport, useId, watchPostEffect } from 'vue';
import type { Component } from 'vue';
import { EMPTY_OBJECT } from '../../../common/empty';
import { useIsHydrated } from '../../../common/hydration';
import { useKeepAliveState } from '../../../internals/useKeepAliveState';
import { useRenderElement } from '../../../internals/useRenderElement';
import type { HTMLProps } from '../../../internals/types';
import { createAttribute } from '../createAttribute';
import { DismissPortalRegistration, PortalNode, usePortalRegistration } from './portalElements';
import PopupPortalChildren from './PopupPortalChildren.vue';

defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<PopupPortalProps>(), { as: 'div', disabled: false });
defineSlots<{
  default(props: { state: PopupPortalState }): unknown;
  render(props: { props: HTMLProps; state: PopupPortalState; children: Component }): unknown;
}>();

const state: PopupPortalState = EMPTY_OBJECT;
const id = useId();
const portalAttribute = createAttribute('portal');
const parent = inject(PortalNode, undefined);
const mounted = useIsHydrated();
const target = computed(() => {
  if (!mounted.value || props.disabled || props.to === null) {
    return null;
  }
  const doc = parent?.value?.ownerDocument ?? document;
  return typeof props.to === 'string' ? doc.querySelector(props.to) : props.to ?? parent?.value ?? doc.body;
});
const { isHeld } = useKeepAliveState();
const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  props: (attrs) => [{ id, [portalAttribute]: '' }, attrs],
  children: true,
});
provide(PortalNode, element);
usePortalRegistration(element, isHeld, target, inject(DismissPortalRegistration, undefined));

const start = shallowRef<Comment | Text | HTMLElement | null>(null);
const anchorComponent = props.guards?.(element, props, start);
const needsAnchor = shallowRef(false);
function setStart(node: unknown) {
  const anchor = (node as { anchor?: HTMLElement } | null)?.anchor ?? node;
  start.value = anchor && typeof anchor === 'object' && 'nodeType' in anchor ? anchor as ChildNode & (HTMLElement | Text | Comment) : null;
}
if (anchorComponent) {
  // Compiled Vapor can render a Teleport without a source ref. Give its guards a real anchor.
  watchPostEffect(() => {
    if (target.value && !start.value) {
      needsAnchor.value = true;
    }
  });
}
const transport = computed(() => needsAnchor.value && anchorComponent ? anchorComponent : Teleport);

defineExpose({ element });
</script>

<template>
  <slot v-if="disabled && usesRenderSlot()" name="render" :props="elementProps()" :state="state" :children="PopupPortalChildren" />
  <component :is="as" v-else-if="disabled" v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
  <component :is="transport" v-else-if="target" :ref="anchorComponent ? setStart : undefined" :to="target" :disabled="isHeld">
    <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" :children="PopupPortalChildren" />
    <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
      <slot :state="state" />
    </component>
  </component>
</template>
